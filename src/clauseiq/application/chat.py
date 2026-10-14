"""Conversational Q&A on contracts grounded in document excerpts and Indian statutory law.

Exposes ``ContractChatService``:
1. Performs lexical retrieval over the contract text to isolate relevant clauses.
2. Queries the ``LawRepository`` for applicable statutory sections (ICA 1872).
3. Prompts the LLM (Gemini) to generate a structured, grounded answer.
4. Verifies any cited statutory sections against the corpus (anti-hallucination guarantee).
"""

from __future__ import annotations

import re
from typing import ClassVar

from clauseiq.application.schemas import (
    CitationOut,
    ContractChatRequest,
    ContractChatResponse,
    ContractChatStructuredResult,
    ProposedCitation,
)
from clauseiq.domain.entities import Citation, ScoredChunk
from clauseiq.domain.exceptions import ClauseIQError, GuardrailError
from clauseiq.domain.ports import LawRepository
from clauseiq.domain.result import Err, Ok, Result
from clauseiq.domain.value_objects import LawCode
from clauseiq.infrastructure.guardrails.injection_detector import detect_injection
from clauseiq.infrastructure.llm.base import LLMClient
from clauseiq.infrastructure.observability.langfuse_client import traced
from clauseiq.logging_config import get_logger

log = get_logger(__name__)

_TOKEN_RE = re.compile(r"[a-z0-9]+")

_CHAT_SYSTEM = (
    "You are an expert Indian contract legal counselor. You assist users (tenants, "
    "employees, freelancers, and businesses) by answering questions about their contract.\n"
    "Rules:\n"
    "1. Answer directly and objectively based on the provided contract excerpts.\n"
    "2. If the contract does not mention the topic or is silent, say clearly: "
    "'The provided contract text does not contain provisions addressing this topic.'\n"
    "3. Point out any clauses that appear unfair, one-sided, or legally questionable under Indian law.\n"
    "4. Highlight 1 to 3 verbatim excerpt snippets from the contract supporting your answer.\n"
    "5. Cite ONLY sections present in the provided Indian law context. Never invent statutory sections."
)


def _tokens(text: str) -> set[str]:
    return set(_TOKEN_RE.findall(text.lower()))


def _coerce_law_code(value: str) -> LawCode:
    try:
        return LawCode(value.strip())
    except ValueError:
        return LawCode.OTHER


def _extract_contract_excerpts(contract_text: str, question: str, top_k: int = 5) -> list[str]:
    """Rank paragraphs/blocks of the contract by token overlap with the question."""
    raw_blocks = re.split(r"\n\s*\n|\n(?=[0-9]+\.|\bClause\b|\bSection\b)", contract_text)
    blocks = [b.strip() for b in raw_blocks if len(b.strip()) > 20]
    if not blocks:
        return [contract_text[:1500]]

    q_tokens = _tokens(question)
    scored: list[tuple[int, str]] = []
    for block in blocks:
        overlap = len(q_tokens & _tokens(block))
        scored.append((overlap, block))

    scored.sort(key=lambda item: item[0], reverse=True)
    selected = [block for score, block in scored[:top_k] if score > 0]
    return selected if selected else blocks[:top_k]


class ContractChatService:
    """Answers user questions grounded in contract text + verified Indian law."""

    name: ClassVar[str] = "contract_chat_service"

    def __init__(self, llm: LLMClient, law_repo: LawRepository) -> None:
        self._llm = llm
        self._law_repo = law_repo

    async def _verify_citations(self, proposed: list[ProposedCitation]) -> list[Citation]:
        verified: list[Citation] = []
        for item in proposed:
            code = _coerce_law_code(item.law_code)
            res = await self._law_repo.get_section(code, item.section_number)
            if res.is_ok():
                verified.append(res.unwrap())
            else:
                log.info("chat_citation_rejected", law_code=item.law_code, section=item.section_number)
        return verified

    def _build_prompt(
        self,
        request: ContractChatRequest,
        contract_excerpts: list[str],
        law_chunks: list[ScoredChunk],
    ) -> str:
        parts: list[str] = [
            "### RELEVANT CONTRACT EXCERPTS:",
            "\n---\n".join(contract_excerpts) if contract_excerpts else "(No excerpts found)",
            "",
            "### RELEVANT STATUTORY INDIAN LAW:",
        ]

        if law_chunks:
            for sc in law_chunks:
                law_code = sc.chunk.metadata.get("law_code", "ICA_1872")
                sec_num = sc.chunk.metadata.get("section_number", "?")
                sec_title = sc.chunk.metadata.get("section_title", "")
                parts.append(f"- [{law_code} s{sec_num}] {sec_title}: {sc.chunk.text[:350]}")
        else:
            parts.append("(No specific statutory sections retrieved)")

        if request.chat_history:
            parts.append("")
            parts.append("### RECENT CONVERSATION HISTORY:")
            for msg in request.chat_history[-4:]:
                parts.append(f"{msg.role.upper()}: {msg.content}")

        parts.append("")
        parts.append(f"USER QUESTION: {request.question}")
        parts.append(
            "Please provide a clear answer, quote the exact relevant clause excerpts, "
            "and cite only real statutory sections from the context above."
        )
        return "\n".join(parts)

    @traced("contract_chat")
    async def ask(
        self, request: ContractChatRequest
    ) -> Result[ContractChatResponse, ClauseIQError]:
        """Process a conversational question with grounding and citation verification."""
        # 1. Guardrail against prompt injection in the question
        injection = detect_injection(request.question)
        if injection.detected:
            log.warning("chat_injection_detected", matches=list(injection.matches))
            return Err(GuardrailError("prompt_injection_detected", matches=list(injection.matches)))

        # 2. Extract relevant contract clauses
        excerpts = _extract_contract_excerpts(request.contract_text, request.question)

        # 3. Retrieve relevant Indian law sections
        law_search = await self._law_repo.search(
            request.question, k=4, jurisdiction=request.jurisdiction
        )
        law_chunks = law_search.unwrap() if law_search.is_ok() else []

        # 4. Generate structured response with LLM
        prompt = self._build_prompt(request, excerpts, law_chunks)
        llm_res = await self._llm.generate_structured(
            prompt, ContractChatStructuredResult, system=_CHAT_SYSTEM, temperature=0.2
        )
        if llm_res.is_err():
            err = llm_res.unwrap_err()
            log.error("contract_chat_llm_failed", error=err.message)
            return Err(err)

        structured = llm_res.unwrap()

        # 5. Anti-hallucination verification for cited statutory sections
        verified_citations = await self._verify_citations(structured.citations)
        citation_outs = [
            CitationOut.from_domain(c, amendment_note=c.amendment_note)
            for c in verified_citations
        ]

        response = ContractChatResponse(
            answer=structured.answer,
            relevant_clause_excerpts=structured.relevant_clause_excerpts,
            citations=citation_outs,
        )
        log.info(
            "contract_chat_complete",
            excerpts_count=len(response.relevant_clause_excerpts),
            citations_count=len(response.citations),
        )
        return Ok(response)


__all__ = ["ContractChatService"]
