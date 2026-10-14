"""Retriever agent — fetches relevant Indian law for the contract.

No LLM: it runs each of the supervisor's retrieval queries through the hybrid
``LawRepository`` and merges the hits into a single, de-duplicated, score-ranked
pool capped at ``pool_size``. The analyzer later draws per-clause context from
this pool. Falls back to clause text as queries if the supervisor produced none.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

if TYPE_CHECKING:
    from clauseiq.infrastructure.ingestion.web_law_fetcher import InternetLawFetcher

from clauseiq.application.agents.state import AnalysisState
from clauseiq.domain.entities import ScoredChunk
from clauseiq.domain.ports import LawRepository
from clauseiq.infrastructure.observability.langfuse_client import traced
from clauseiq.logging_config import get_logger

log = get_logger(__name__)


class RetrieverAgent:
    """LangGraph node: builds the relevant-law pool via hybrid retrieval.

    Follows a strict cache-first strategy:
    1. If the statute is already present in the local database, DO NOT go to the internet.
    2. If a required statute is missing, fetches it from the internet, auto-caches it,
       and then retrieves locally.
    """

    name: ClassVar[str] = "retriever"

    def __init__(
        self,
        law_repo: LawRepository,
        *,
        web_fetcher: InternetLawFetcher | None = None,
        per_query_k: int = 5,
        pool_size: int = 12,
    ) -> None:
        self._law_repo = law_repo
        self._web_fetcher = web_fetcher
        self._per_query_k = per_query_k
        self._pool_size = pool_size

    async def _ensure_statutes_cached(self, applicable_statutes: list[str]) -> None:
        """Verify required statutes are present locally; fetch from internet only on cache miss."""
        import asyncio
        from clauseiq.infrastructure.ingestion.web_law_fetcher import STATUTE_ALIASES

        for statute in applicable_statutes:
            clean_code = statute.strip().upper()
            if not clean_code:
                continue

            norm_code = STATUTE_ALIASES.get(clean_code, clean_code)

            # 1. Local database check (check both normalized code and original code)
            is_present = await self._law_repo.has_statute(norm_code) or await self._law_repo.has_statute(clean_code)
            if is_present:
                log.info("statute_cache_hit_local", statute=clean_code, code=norm_code)
                # DO NOT fetch from internet
                continue

            # 2. Cache miss -> Fetch from internet only if missing (with resilient timeout)
            if self._web_fetcher is not None:
                log.info("statute_cache_miss_fetching_internet", statute=clean_code, code=norm_code)
                try:
                    corpus = await asyncio.wait_for(
                        self._web_fetcher.fetch_statute(norm_code),
                        timeout=20.0,
                    )
                    if corpus and hasattr(self._law_repo, "ingest_corpus"):
                        await self._law_repo.ingest_corpus(corpus)  # type: ignore[union-attr]
                        log.info("statute_cached_successfully", statute=clean_code, code=norm_code)
                except Exception as exc:
                    log.warning("internet_fetch_failed", statute=clean_code, error=str(exc))

    @traced("retriever")
    async def __call__(self, state: AnalysisState) -> dict[str, object]:
        applicable_statutes = state.get("applicable_statutes") or []
        if applicable_statutes:
            try:
                await self._ensure_statutes_cached(applicable_statutes)
            except Exception as exc:
                log.warning("ensure_statutes_cached_failed", error=str(exc))

        raw_queries = list(state.get("retrieval_queries") or [])
        if not raw_queries:
            raw_queries = [clause.text for clause in state.get("clauses", [])]
        queries = list(dict.fromkeys(q.strip() for q in raw_queries if q.strip()))[:4]

        best_by_id: dict[str, ScoredChunk] = {}

        # Prioritize and include provisions from the contract's applicable governing statutes
        from clauseiq.infrastructure.ingestion.web_law_fetcher import STATUTE_ALIASES

        if hasattr(self._law_repo, "_store"):
            try:
                for statute in applicable_statutes:
                    clean_code = statute.strip().upper()
                    norm_code = STATUTE_ALIASES.get(clean_code, clean_code)
                    statute_chunks = await self._law_repo._store.get_all(where={"law_code": norm_code})
                    if not statute_chunks and clean_code != norm_code:
                        statute_chunks = await self._law_repo._store.get_all(where={"law_code": clean_code})
                    for chunk in statute_chunks:
                        best_by_id[chunk.id] = ScoredChunk(chunk=chunk, score=0.95)
            except Exception as exc:
                log.warning("retriever_statute_store_lookup_failed", error=str(exc))

        for query in queries:
            if not query.strip():
                continue
            try:
                result = await self._law_repo.search(query, self._per_query_k)
                if result.is_err():
                    log.warning("retriever_query_failed", code=result.unwrap_err().message)
                    continue
                for scored in result.unwrap():
                    existing = best_by_id.get(scored.chunk.id)
                    if existing is None or scored.score > existing.score:
                        best_by_id[scored.chunk.id] = scored
            except Exception as exc:
                log.warning("retriever_search_exception", query=query, error=str(exc))

        # Ensure balanced pool with both applicable statute provisions and general contract law
        pool = sorted(best_by_id.values(), key=lambda s: s.score, reverse=True)[: max(self._pool_size, len(best_by_id))]
        log.info("retriever_complete", queries=len(queries), pool=len(pool))
        return {"law_pool": pool}


__all__ = ["RetrieverAgent"]
