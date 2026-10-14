"""Supervisor agent (Gemini Flash) — triage, segmentation, retrieval planning.

The first node. It uses the fast orchestration model to:

1. decide whether the input is actually a contract (a cheap input guardrail),
2. segment it into clauses with a best-guess type, and
3. propose legal-topic queries for the retriever.

Output is a validated :class:`SegmentationResult` — no free-text parsing — so
downstream nodes receive structured data.
"""

from __future__ import annotations

from typing import ClassVar

from clauseiq.application.agents.state import AnalysisState
from clauseiq.application.schemas import SegmentedClause, SegmentationResult
from clauseiq.domain.value_objects import ClauseType
from clauseiq.infrastructure.llm.base import LLMClient
from clauseiq.infrastructure.observability.langfuse_client import traced
from clauseiq.logging_config import get_logger

log = get_logger(__name__)

_CLAUSE_TYPES = ", ".join(member.value for member in ClauseType)

_SYSTEM = (
    "You are an expert contract-triage and legal-profiling assistant. You classify "
    "contracts of any type (e.g. employment, residential/commercial lease, software/SaaS, "
    "NDA, freelance service, consumer), identify the vulnerable or negotiating party to protect, "
    "determine applicable statutory frameworks, segment the contract into individual clauses, "
    "and plan targeted legal retrieval. Never invent clause text — copy it verbatim from the input."
)

_PROMPT_TEMPLATE = (
    "Analyse the following document.\n"
    "1. Set is_contract=false ONLY if the document is clearly non-legal text (e.g. recipe, code snippet, casual chat, or fiction). If it is a contract, agreement, individual clause, or excerpt from an agreement, set is_contract=true.\n"
    "2. If it is a contract:\n"
    "   - contract_type: Identify the contract category (e.g. 'employment', 'residential_lease', "
    "'commercial_lease', 'software_saas', 'nda_confidentiality', 'services_freelance', 'consumer_b2c', 'vendor_procurement', 'general').\n"
    "   - protecting_party: Identify the vulnerable/negotiating party to protect (e.g. 'employee', 'tenant', 'freelancer', 'consumer', 'customer', 'licensee').\n"
    "   - applicable_statutes: Propose 1-4 relevant statute/regulation codes governing this agreement "
    "(e.g. ICA_1872, CPA_2019, SRA_1963, IT_ACT_2000, DPDP_2023, or relevant state rent/labour codes).\n"
    "3. Split the contract into individual clauses. For each clause give its 0-based index, "
    "an optional heading, verbatim text, and best-fitting clause_type from: {clause_types}.\n"
    "4. Propose 3-8 targeted retrieval_queries (legal topics/concepts) to find statutory provisions "
    "relevant to the riskier clauses.\n\n"
    "DOCUMENT:\n{contract_text}"
)


class SupervisorAgent:
    """LangGraph node: segments the contract and plans retrieval (Flash)."""

    name: ClassVar[str] = "supervisor"

    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    @traced("supervisor")
    async def __call__(self, state: AnalysisState) -> dict[str, object]:
        contract_text = state["contract_text"]
        prompt = _PROMPT_TEMPLATE.format(clause_types=_CLAUSE_TYPES, contract_text=contract_text)
        result = await self._llm.generate_structured(
            prompt, SegmentationResult, system=_SYSTEM, temperature=0.1
        )
        if result.is_err():
            error = result.unwrap_err()
            log.error("supervisor_failed", code=error.message)
            return {
                "is_contract": False,
                "contract_type": "general",
                "protecting_party": None,
                "applicable_statutes": [],
                "clauses": [],
                "retrieval_queries": [],
                "error": f"segmentation_failed:{error.message}",
            }

        segmentation = result.unwrap()
        if not segmentation.is_contract:
            log.info("supervisor_not_a_contract")
            return {
                "is_contract": False,
                "contract_type": segmentation.contract_type or "general",
                "protecting_party": segmentation.protecting_party,
                "applicable_statutes": list(segmentation.applicable_statutes),
                "clauses": list(segmentation.clauses),
                "retrieval_queries": [],
                "error": None,
            }

        if not segmentation.clauses:
            if contract_text.strip() and len(contract_text.strip()) >= 25:
                log.info("supervisor_fallback_to_single_clause")
                clauses = [
                    SegmentedClause(
                        index=0,
                        heading=None,
                        text=contract_text.strip(),
                        clause_type=ClauseType.OTHER,
                    )
                ]
                queries = list(segmentation.retrieval_queries) if segmentation.retrieval_queries else [
                    contract_text.strip()[:200]
                ]
                statutes = list(segmentation.applicable_statutes) if segmentation.applicable_statutes else ["ICA_1872"]
                return {
                    "is_contract": True,
                    "contract_type": segmentation.contract_type or "general",
                    "protecting_party": segmentation.protecting_party or "negotiating party",
                    "applicable_statutes": statutes,
                    "clauses": clauses,
                    "retrieval_queries": queries,
                    "error": None,
                }

            log.info("supervisor_no_clauses")
            return {
                "is_contract": False,
                "contract_type": segmentation.contract_type or "general",
                "protecting_party": segmentation.protecting_party,
                "applicable_statutes": list(segmentation.applicable_statutes),
                "clauses": [],
                "retrieval_queries": [],
                "error": None,
            }

        log.info(
            "supervisor_complete",
            contract_type=segmentation.contract_type,
            protecting_party=segmentation.protecting_party,
            clauses=len(segmentation.clauses),
            queries=len(segmentation.retrieval_queries),
        )
        return {
            "is_contract": True,
            "contract_type": segmentation.contract_type or "general",
            "protecting_party": segmentation.protecting_party,
            "applicable_statutes": list(segmentation.applicable_statutes),
            "clauses": list(segmentation.clauses),
            "retrieval_queries": list(segmentation.retrieval_queries),
            "error": None,
        }


__all__ = ["SupervisorAgent"]
