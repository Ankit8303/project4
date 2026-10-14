"""FastAPI dependency wiring (composition root for the HTTP interface).

The law repository and contract analyzer are **heavy** to construct (they load
the embedding model and build the BM25 index), so they are built once, lazily on
first use, and cached on ``app.state`` behind a lock. Tests override these
dependencies with fakes via ``app.dependency_overrides``, so route tests never
load a model or call a real LLM.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from fastapi import Request

if TYPE_CHECKING:
    from clauseiq.application.chat import ContractChatService
    from clauseiq.application.diff import ContractDiffService

from clauseiq.application.workflows import AnalysisDeps, ContractAnalyzer
from clauseiq.config import settings
from clauseiq.domain.ports import LawRepository
from clauseiq.infrastructure.llm.factory import LLMRole, get_llm_client
from clauseiq.infrastructure.repositories.law import build_law_repository
from clauseiq.logging_config import get_logger

log = get_logger(__name__)

_build_lock = asyncio.Lock()


async def get_law_repository(request: Request) -> LawRepository:
    """Return the shared law repository, building it once on first use."""
    state = request.app.state
    repo: LawRepository | None = getattr(state, "law_repo", None)
    if repo is not None:
        return repo
    async with _build_lock:
        repo = getattr(state, "law_repo", None)
        if repo is None:
            log.info("building_law_repository")
            repo = await build_law_repository()
            state.law_repo = repo
    return repo


async def get_contract_analyzer(request: Request) -> ContractAnalyzer:
    """Return the shared contract analyzer, building it once on first use."""
    state = request.app.state
    analyzer: ContractAnalyzer | None = getattr(state, "analyzer", None)
    if analyzer is not None:
        return analyzer
    repo = await get_law_repository(request)  # acquired/released before the lock below
    async with _build_lock:
        analyzer = getattr(state, "analyzer", None)
        if analyzer is None:
            deps = AnalysisDeps(
                supervisor_llm=get_llm_client(LLMRole.ORCHESTRATION),
                analyzer_llm=get_llm_client(LLMRole.ANALYSIS),
                law_repo=repo,
                corpus_version=settings.corpus_version,
            )
            analyzer = ContractAnalyzer(deps)
            state.analyzer = analyzer
            log.info("built_contract_analyzer", corpus_version=settings.corpus_version)
    return analyzer


async def get_contract_chat_service(request: Request) -> ContractChatService:
    """Return the shared contract chat service, building it once on first use."""
    from clauseiq.application.chat import ContractChatService

    state = request.app.state
    service: ContractChatService | None = getattr(state, "chat_service", None)
    if service is not None:
        return service
    repo = await get_law_repository(request)
    async with _build_lock:
        service = getattr(state, "chat_service", None)
        if service is None:
            llm = get_llm_client(LLMRole.ANALYSIS)
            service = ContractChatService(llm=llm, law_repo=repo)
            state.chat_service = service
            log.info("built_contract_chat_service")
    return service


async def get_contract_diff_service(request: Request) -> ContractDiffService:
    """Return the shared contract diff service, building it once on first use."""
    from clauseiq.application.diff import ContractDiffService

    state = request.app.state
    service: ContractDiffService | None = getattr(state, "diff_service", None)
    if service is not None:
        return service
    async with _build_lock:
        service = getattr(state, "diff_service", None)
        if service is None:
            llm = get_llm_client(LLMRole.ANALYSIS)
            service = ContractDiffService(llm=llm)
            state.diff_service = service
            log.info("built_contract_diff_service")
    return service


__all__ = [
    "get_contract_analyzer",
    "get_contract_chat_service",
    "get_contract_diff_service",
    "get_law_repository",
]

