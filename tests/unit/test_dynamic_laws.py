"""Unit tests for dynamic law registry, contract categorization, and multi-statute support."""

from __future__ import annotations

from datetime import date
from collections.abc import Mapping, Sequence

import pytest

from clauseiq.application.agents.citation_verifier import CitationVerifierAgent, _coerce_law_code
from clauseiq.application.agents.risk_analyzer import _build_system_prompt
from clauseiq.application.schemas import (
    CitationOut,
    ContractAnalysis,
    ProposedCitation,
    RiskFlagOut,
    SegmentationResult,
    SegmentedClause,
)
from clauseiq.domain.entities import Chunk, Citation, RiskFlag
from clauseiq.domain.exceptions import RepositoryError
from clauseiq.domain.result import Err, Ok, Result
from clauseiq.domain.value_objects import (
    ClauseType,
    ContractCategory,
    Jurisdiction,
    LawCode,
    Severity,
    get_statute_title,
    register_statute_title,
)
from clauseiq.infrastructure.repositories.law import ChromaLawRepository


class _FakeStore:
    def __init__(self, chunks: Sequence[Chunk]) -> None:
        self._chunks = list(chunks)

    async def add(self, chunks: Sequence[Chunk], embeddings: Sequence[Sequence[float]]) -> None:
        self._chunks.extend(chunks)

    async def query(self, embedding: Sequence[float], k: int, *, where: Mapping[str, str] | None = None):
        return []

    async def get_all(self, *, where: Mapping[str, str] | None = None) -> list[Chunk]:
        if where is None:
            return list(self._chunks)
        return [c for c in self._chunks if all(c.metadata.get(k) == v for k, v in where.items())]

    async def count(self) -> int:
        return len(self._chunks)


class _FakeRetriever:
    async def retrieve(self, query: str, k: int = 5):
        return Ok([])


def test_dynamic_statute_title_registration() -> None:
    register_statute_title("DPDP_2023", "Digital Personal Data Protection Act, 2023")
    assert get_statute_title("DPDP_2023") == "Digital Personal Data Protection Act, 2023"
    assert get_statute_title(LawCode.ICA_1872) == "Indian Contract Act, 1872"
    # Unregistered fallback humanizes snake_case
    assert get_statute_title("MY_CUSTOM_CODE_2025") == "My Custom Code 2025"


def test_citation_with_dynamic_law_code() -> None:
    citation = Citation(
        law_code="CPA_2019",
        section_number="2(46)",
        section_title="Unfair contract definition",
        snippet="unfair contract means...",
        effective_date=date(2020, 7, 20),
    )
    assert citation.law_code == "CPA_2019"
    assert "Consumer Protection Act, 2019" in citation.reference
    assert "Section 2(46)" in citation.reference

    out = CitationOut.from_domain(citation)
    assert out.law_code == "CPA_2019"
    assert out.section_number == "2(46)"
    assert "Consumer Protection Act, 2019" in out.reference


async def test_dynamic_citation_verifier_resolves_arbitrary_statutes() -> None:
    chunk = Chunk(
        id="CPA_2019:s2(46)::c0",
        text="manifestly excessive security deposit is unfair",
        metadata={
            "law_code": "CPA_2019",
            "statute_title": "Consumer Protection Act, 2019",
            "section_number": "2(46)",
            "section_title": "Unfair contract definition",
            "parent_section": "CPA_2019:s2(46)",
        },
    )
    repo = ChromaLawRepository(_FakeStore([chunk]), _FakeRetriever())
    verifier = CitationVerifierAgent(repo)

    state = {
        "contract_id": "test-cpa",
        "clauses": [
            SegmentedClause(index=0, text="Consumer pays 10x deposit", clause_type="security_deposit")
        ],
        "raw_flags": [
            type(
                "RawFlag",
                (),
                {
                    "clause_index": 0,
                    "clause_type": "security_deposit",
                    "severity_score": 4,
                    "rationale": "Excessive deposit is void under CPA",
                    "confidence": 0.9,
                    "suggested_action": "Reduce deposit",
                    "suggested_revision": "Deposit shall not exceed 1 month rent",
                    "negotiation_rationale": "Align with Consumer Protection Act",
                    "negotiation_email_snippet": "Please modify the deposit terms",
                    "citations": [ProposedCitation(law_code="CPA_2019", section_number="2(46)")],
                },
            )()
        ],
    }

    result = await verifier(state)
    flags = result.get("flags", [])
    assert len(flags) == 1
    assert flags[0].citations[0].law_code == "CPA_2019"
    assert flags[0].citations[0].section_number == "2(46)"


def test_contract_analysis_build_with_contract_profiling() -> None:
    flags = [
        RiskFlagOut(
            clause_id="c1",
            clause_excerpt="Non-compete 2 years",
            clause_type="non_compete",
            severity_score=5,
            severity_label="critical",
            rationale="Void under s.27 ICA",
            confidence=0.95,
        )
    ]
    analysis = ContractAnalysis.build(
        contract_id="contract-123",
        jurisdiction=Jurisdiction.IN_KA,
        flags=flags,
        corpus_version="v1",
        disclaimer="Disclaimer text",
        contract_type=ContractCategory.EMPLOYMENT.value,
        protecting_party="employee",
        applicable_statutes=["ICA_1872", "KA_SHOPS_1961"],
    )
    assert analysis.contract_type == "employment"
    assert analysis.protecting_party == "employee"
    assert "KA_SHOPS_1961" in analysis.applicable_statutes
    assert analysis.highest_severity == "critical"


def test_risk_analyzer_dynamic_system_prompt() -> None:
    prompt = _build_system_prompt("employment", "employee")
    assert "employment" in prompt
    assert "employee" in prompt


class _TrackingWebFetcher:
    def __init__(self) -> None:
        self.fetch_calls: list[str] = []

    async def fetch_statute(self, statute_identifier: str):
        self.fetch_calls.append(statute_identifier)
        from clauseiq.infrastructure.ingestion.law_ingestor import LawCorpus, LawSection
        return LawCorpus(
            law_code=statute_identifier,
            statute_title=f"Test {statute_identifier}",
            version="v1",
            source_url="http://test.url",
            source_fetched_at=date.today(),
            effective_date=date.today(),
            sections=[
                LawSection(
                    section_number="1",
                    section_title="Short title",
                    section_text=f"1. Short title of {statute_identifier}.",
                )
            ],
        )


async def test_retriever_cache_hit_does_not_fetch_from_internet() -> None:
    """When a statute is already in the database, DO NOT go to the internet."""
    from clauseiq.application.agents.retriever import RetrieverAgent

    # Chunks for ICA_1872 already present in local store
    chunk = Chunk(
        id="ICA_1872:s10::c0",
        text="All agreements are contracts",
        metadata={
            "law_code": "ICA_1872",
            "section_number": "10",
            "parent_section": "ICA_1872:s10",
        },
    )
    repo = ChromaLawRepository(_FakeStore([chunk]), _FakeRetriever())
    tracker = _TrackingWebFetcher()
    retriever = RetrieverAgent(repo, web_fetcher=tracker)

    # State specifies ICA_1872
    state = {
        "applicable_statutes": ["ICA_1872"],
        "retrieval_queries": ["contracts free consent"],
    }
    await retriever(state)

    # Verified: Zero calls to the internet!
    assert len(tracker.fetch_calls) == 0


async def test_retriever_cache_miss_fetches_from_internet_and_caches() -> None:
    """When a statute is missing from the database, fetch from the internet and cache it."""
    from clauseiq.application.agents.retriever import RetrieverAgent

    store = _FakeStore([])  # Empty database
    repo = ChromaLawRepository(store, _FakeRetriever())
    tracker = _TrackingWebFetcher()
    retriever = RetrieverAgent(repo, web_fetcher=tracker)

    # State specifies KA_SHOPS_1961 which is missing from store
    state = {
        "applicable_statutes": ["KA_SHOPS_1961"],
        "retrieval_queries": ["notice period termination"],
    }
    await retriever(state)

    # Verified: Internet fetcher was called for the missing statute
    assert tracker.fetch_calls == ["KA_SHOPS_1961"]
    # Verified: Statute is now recorded as present
    assert await repo.has_statute("KA_SHOPS_1961")

