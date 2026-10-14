"""Contract Version Diff and Sneaky Clause Detector service.

Compares an original contract draft (V1) against a counterparty revised draft (V2).
Detects:
1. Added, modified, and deleted clauses.
2. Sneaky modifications (e.g. quietly shortened notice period, new forfeiture triggers,
   one-sided indemnity additions, or removed counterparty obligations).
3. Produces a comprehensive risk verdict ('more_risky', 'safer', or 'neutral').
"""

from __future__ import annotations

import re
from typing import ClassVar

from clauseiq.application.schemas import (
    ContractDiffRequest,
    ContractDiffResponse,
)
from clauseiq.domain.exceptions import ClauseIQError, GuardrailError
from clauseiq.domain.result import Err, Ok, Result
from clauseiq.infrastructure.guardrails.injection_detector import detect_injection
from clauseiq.infrastructure.llm.base import LLMClient
from clauseiq.infrastructure.observability.langfuse_client import traced
from clauseiq.logging_config import get_logger

log = get_logger(__name__)

_DIFF_SYSTEM = (
    "You are an expert Indian contract attorney specializing in adversarial contract review.\n"
    "Your job is to compare an Original Contract (Draft 1) against a Revised Contract (Draft 2) "
    "sent by a counterparty (e.g. landlord, employer, client).\n"
    "Identify any 'sneaky' traps: changes where the counterparty quietly shifted liability, "
    "shortened notice periods, broadened restrictions, or removed protections.\n"
    "For each notable change, provide: change_type ('added', 'removed', 'modified'), "
    "clause_title, original_text, revised_text, is_sneaky_risk (bool), risk_explanation, "
    "and a practical recommendation for negotiation."
)


def _split_clauses(text: str) -> list[str]:
    """Split text into distinct clauses or paragraphs."""
    raw = re.split(r"\n\s*\n|\n(?=[0-9]+\.|\bClause\b|\bSection\b)", text)
    return [b.strip() for b in raw if len(b.strip()) > 15]


class ContractDiffService:
    """Analyzes differences between V1 and V2 to catch unannounced liabilities."""

    name: ClassVar[str] = "contract_diff_service"

    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    def _build_prompt(
        self, request: ContractDiffRequest, v1_clauses: list[str], v2_clauses: list[str]
    ) -> str:
        prompt_parts: list[str] = [
            "### ORIGINAL DRAFT (V1):",
            "\n\n".join(f"[V1-{i+1}]: {cl}" for i, cl in enumerate(v1_clauses[:25])),
            "",
            "### REVISED COUNTERPARTY DRAFT (V2):",
            "\n\n".join(f"[V2-{i+1}]: {cl}" for i, cl in enumerate(v2_clauses[:25])),
            "",
            "### TASK:",
            "Compare the two versions. Highlight all substantive additions, modifications, and removals.",
            "Flag any changes that represent a stealth risk or trap to the weaker party (is_sneaky_risk=True).",
            "Provide an executive summary and overall risk_verdict ('more_risky', 'safer', or 'neutral').",
        ]
        return "\n".join(prompt_parts)

    @traced("contract_diff")
    async def compare(
        self, request: ContractDiffRequest
    ) -> Result[ContractDiffResponse, ClauseIQError]:
        """Run comparison between original and revised contracts."""
        # 1. Guardrail against injection
        inj_orig = detect_injection(request.original_text)
        inj_rev = detect_injection(request.revised_text)
        if inj_orig.detected or inj_rev.detected:
            matches = list(inj_orig.matches) + list(inj_rev.matches)
            log.warning("diff_injection_detected", matches=matches)
            return Err(GuardrailError("prompt_injection_detected", matches=matches))

        # 2. Extract clauses
        v1_clauses = _split_clauses(request.original_text)
        v2_clauses = _split_clauses(request.revised_text)

        # 3. LLM structured comparison
        prompt = self._build_prompt(request, v1_clauses, v2_clauses)
        result = await self._llm.generate_structured(
            prompt, ContractDiffResponse, system=_DIFF_SYSTEM, temperature=0.2
        )
        if result.is_err():
            err = result.unwrap_err()
            log.error("contract_diff_failed", error=err.message)
            return Err(err)

        diff_res = result.unwrap()
        log.info(
            "contract_diff_complete",
            changes=diff_res.total_changes,
            traps=diff_res.sneaky_traps_count,
            verdict=diff_res.risk_verdict,
        )
        return Ok(diff_res)


__all__ = ["ContractDiffService"]
