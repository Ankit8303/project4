"""Law repository — read access to the Indian statutory corpus.

Implements the domain :class:`~clauseiq.domain.ports.LawRepository` port over a
ChromaDB-backed vector store plus a hybrid retriever. ``search`` returns ranked
chunks; ``get_section`` returns a single section as a :class:`Citation`.

Amendment caveat (must be honoured downstream): a section's ``last_amended`` is
``None`` whenever the corpus could not derive it, and the corpus does not track
amendment history. :func:`amendment_history_note` returns the user-facing string
to display (e.g. on the frontend) so we never imply a citation reflects the
current, amended law.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from clauseiq.domain.entities import Chunk, Citation, ScoredChunk
from clauseiq.domain.exceptions import (
    LawSectionNotFoundError,
    RepositoryError,
    VectorStoreError,
)
from clauseiq.domain.ports import Retriever, VectorStore
from clauseiq.domain.result import Err, Ok, Result
from clauseiq.domain.value_objects import Jurisdiction, LawCode, register_statute_title
from clauseiq.logging_config import get_logger

log = get_logger(__name__)


def amendment_history_note(citation: Citation) -> str | None:
    """Thin wrapper over :attr:`Citation.amendment_note` (domain source of truth)."""
    return citation.amendment_note


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _law_code(value: str | None) -> LawCode | str:
    if not value:
        return LawCode.OTHER
    try:
        return LawCode(value)
    except ValueError:
        return value.strip()


class ChromaLawRepository:
    """ChromaDB-backed implementation of the ``LawRepository`` port."""

    def __init__(self, store: VectorStore, retriever: Retriever) -> None:
        self._store = store
        self._retriever = retriever

    async def search(
        self,
        query: str,
        k: int = 5,
        *,
        jurisdiction: Jurisdiction | None = None,
    ) -> Result[list[ScoredChunk], RepositoryError]:
        """Hybrid-search the law corpus (jurisdiction is reserved for future use)."""
        result = await self._retriever.retrieve(query, k)
        if result.is_err():
            return Err(RepositoryError("law_search_failed", cause=result.unwrap_err()))
        return Ok(result.unwrap())

    async def get_section(
        self,
        law_code: LawCode | str,
        section_number: str,
    ) -> Result[Citation, RepositoryError]:
        """Fetch a single statutory section as a :class:`Citation`."""
        code_str = law_code.value if hasattr(law_code, "value") else str(law_code).strip()
        section_id = f"{code_str}:s{section_number}"
        try:
            chunks = await self._store.get_all(where={"parent_section": section_id})
        except VectorStoreError as exc:
            return Err(RepositoryError("get_section_failed", cause=exc, section=section_id))
        if not chunks:
            return Err(
                LawSectionNotFoundError(
                    "section_not_found", law_code=code_str, section=section_number
                )
            )
        return Ok(self.to_citation(chunks[0]))

    async def count(self) -> int:
        """Return the number of distinct statutory sections stored."""
        chunks = await self._store.get_all()
        return len({chunk.metadata.get("parent_section", chunk.id) for chunk in chunks})

    async def has_statute(self, law_code: LawCode | str) -> bool:
        """Return True if sections for this statute code exist in the vector store."""
        code_str = law_code.value if hasattr(law_code, "value") else str(law_code).strip()
        chunks = await self._store.get_all(where={"law_code": code_str})
        return len(chunks) > 0

    async def ingest_corpus(self, corpus: Any) -> int:
        """Ingest a new LawCorpus directly into the store and register its title."""
        from clauseiq.infrastructure.ingestion.chunker import build_default_chunker
        from clauseiq.infrastructure.ingestion.law_ingestor import ingest_corpus
        from clauseiq.infrastructure.vectorstore.embedder import SentenceTransformerEmbedder

        embedder = SentenceTransformerEmbedder()
        chunker = build_default_chunker()
        report = await ingest_corpus(corpus, store=self._store, embedder=embedder, chunker=chunker)
        register_statute_title(corpus.law_code, corpus.statute_title)
        try:
            from clauseiq.infrastructure.vectorstore.retrieval.bm25 import build_bm25_from_store
            from clauseiq.infrastructure.vectorstore.retrieval.dense import DenseRetriever
            from clauseiq.infrastructure.vectorstore.retrieval.hybrid import HybridRetriever

            bm25 = await build_bm25_from_store(self._store)
            dense = DenseRetriever(self._store, embedder)
            self._retriever = HybridRetriever([dense, bm25])
        except Exception as exc:
            log.warning("failed_refreshing_retriever_index", error=str(exc))
        return report.sections

    async def list_statutes(self) -> list[dict[str, object]]:
        """Return distinct statutes currently stored in the vector repository."""
        chunks = await self._store.get_all()
        statutes: dict[str, dict[str, object]] = {}
        for chunk in chunks:
            code = chunk.metadata.get("law_code") or "OTHER"
            if code not in statutes:
                statutes[code] = {
                    "law_code": code,
                    "statute_title": chunk.metadata.get("statute_title") or code,
                    "source_url": chunk.metadata.get("source_url"),
                    "sections": set(),
                }
            parent = chunk.metadata.get("parent_section") or chunk.id
            statutes[code]["sections"].add(parent)  # type: ignore[union-attr]

        return [
            {
                "law_code": s["law_code"],
                "statute_title": s["statute_title"],
                "source_url": s["source_url"],
                "section_count": len(s["sections"]),  # type: ignore[arg-type]
            }
            for s in statutes.values()
        ]

    @classmethod
    def to_citation(cls, chunk: Chunk, *, relevance_score: float | None = None) -> Citation:
        """Reconstruct a :class:`Citation` from a stored chunk's metadata."""
        metadata = chunk.metadata
        code_val = metadata.get("law_code")
        title_val = metadata.get("statute_title")
        if code_val and title_val:
            register_statute_title(code_val, title_val)

        clamped = max(0.0, min(1.0, relevance_score)) if relevance_score is not None else None
        return Citation(
            law_code=_law_code(code_val),
            section_number=metadata.get("section_number") or "?",
            section_title=metadata.get("section_title") or "Untitled",
            snippet=metadata.get("section_text") or chunk.text,
            source_url=metadata.get("source_url") or None,
            effective_date=_parse_date(metadata.get("effective_date")),
            last_amended=_parse_date(metadata.get("last_amended")),
            source_fetched_at=_parse_date(metadata.get("source_fetched_at")),
            relevance_score=clamped,
        )

    def citation_from_scored(self, scored: ScoredChunk) -> Citation:
        """Build a citation from a search hit, carrying its relevance score."""
        return self.to_citation(scored.chunk, relevance_score=scored.score)


async def build_law_repository() -> ChromaLawRepository:
    """Wire a hybrid law repository from settings (embedded ChromaDB).

    The BM25 index is built from the stored corpus when this is called; in a
    long-lived process it would be built once at startup and cached.
    """
    from clauseiq.infrastructure.vectorstore.chroma import build_law_vector_store
    from clauseiq.infrastructure.vectorstore.embedder import SentenceTransformerEmbedder
    from clauseiq.infrastructure.vectorstore.retrieval.bm25 import build_bm25_from_store
    from clauseiq.infrastructure.vectorstore.retrieval.dense import DenseRetriever
    from clauseiq.infrastructure.vectorstore.retrieval.hybrid import HybridRetriever

    store = build_law_vector_store()
    embedder = SentenceTransformerEmbedder()
    bm25 = await build_bm25_from_store(store)
    dense = DenseRetriever(store, embedder)
    hybrid = HybridRetriever([dense, bm25])
    return ChromaLawRepository(store, hybrid)


__all__ = ["ChromaLawRepository", "amendment_history_note", "build_law_repository"]
