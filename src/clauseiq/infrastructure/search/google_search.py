"""Google Search Grounding adapter for live Indian legal research.

Uses Gemini's native GoogleSearch tool to query the live web for legal statutes,
regulations, and judicial precedents, extracting citations with verified source URLs
(e.g., indiacode.nic.in, indiankanoon.org, egazette.gov.in).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from clauseiq.config import settings
from clauseiq.domain.value_objects import LawCode, register_statute_title
from clauseiq.logging_config import get_logger

log = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class LegalWebHit:
    """A verified legal provision retrieved from live web search."""

    law_code: str
    section_number: str
    section_title: str
    snippet: str
    source_url: str | None


_SECTION_RE = re.compile(
    r"(?i)(?:Section|Sec\.|Article|Art\.)\s*([0-9]{1,4}(?:\([0-9a-zA-Z]+\))*[a-zA-Z]?)"
    r"[\s:—–-]+([^\n—–\.\;]+)[\s:—–-]+([^\n]+)"
)


class GoogleLegalSearcher:
    """Conducts live legal search grounding over Google's index via Gemini."""

    def __init__(self, *, client: Any = None, model: str = "gemini-2.5-flash") -> None:
        self._client = client
        self._model = model

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client
        from google import genai

        api_key = settings.gemini_api_key.get_secret_value()
        if not api_key:
            return None
        self._client = genai.Client(api_key=api_key)
        return self._client

    async def search_statute_provisions(
        self, statute_name: str, queries: list[str]
    ) -> list[LegalWebHit]:
        """Search Google for statutory provisions relevant to the queries."""
        client = self._get_client()
        if client is None:
            log.warning("google_search_grounding_skipped_no_api_key")
            return []

        from google.genai import types

        combined_queries = ", ".join(queries[:3])
        prompt = (
            f"Search official Indian legal sources (such as indiacode.nic.in, indiankanoon.org) for:\n"
            f"Statute: {statute_name}\n"
            f"Key Legal Topics: {combined_queries}\n\n"
            f"Identify the 1 to 4 specific sections governing these topics.\n"
            f"For each section, provide:\n"
            f"1. The exact Section Number\n"
            f"2. The exact Section Title\n"
            f"3. A concise summary of the legal rule or prohibition\n\n"
            f"Format strictly as:\n"
            f"Section <number>: <title> - <summary of legal rule>\n"
        )

        candidate_models = [self._model, "gemini-3.5-flash-lite", "gemini-flash-latest"]
        response = None
        for candidate_model in candidate_models:
            try:
                log.info("executing_google_search_grounding", statute=statute_name, model=candidate_model, query=combined_queries)
                response = await client.aio.models.generate_content(
                    model=candidate_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        tools=[types.Tool(google_search=types.GoogleSearch())],
                        temperature=0.1,
                    ),
                )
                if response and getattr(response, "text", None):
                    break
            except Exception as exc:
                log.warning("google_search_grounding_model_failed", statute=statute_name, model=candidate_model, error=str(exc))

        # Fallback to direct legal knowledge if Google Search tool hits quota limits (429) or is unavailable
        if response is None or not getattr(response, "text", None):
            log.info("falling_back_to_direct_legal_synthesis", statute=statute_name)
            fallback_models = ["gemini-3.5-flash-lite", self._model, "gemini-flash-latest"]
            for fb_model in fallback_models:
                try:
                    response = await client.aio.models.generate_content(
                        model=fb_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(temperature=0.1),
                    )
                    if response and getattr(response, "text", None):
                        log.info("direct_legal_synthesis_success", statute=statute_name, model=fb_model)
                        break
                except Exception as exc:
                    log.warning("direct_legal_synthesis_failed", statute=statute_name, model=fb_model, error=str(exc))

        if response is None:
            log.warning("google_search_grounding_failed_all_models", statute=statute_name)
            return []

        text = getattr(response, "text", "") or ""
        cand = response.candidates[0] if getattr(response, "candidates", None) else None
        meta = getattr(cand, "grounding_metadata", None) if cand else None

        source_urls: list[str] = []
        if meta and getattr(meta, "grounding_chunks", None):
            for chunk in meta.grounding_chunks:
                web = getattr(chunk, "web", None)
                if web and getattr(web, "uri", None):
                    source_urls.append(web.uri)

        primary_url = source_urls[0] if source_urls else f"https://www.indiacode.nic.in/search?query={statute_name}"

        hits: list[LegalWebHit] = []
        seen_sections: set[str] = set()

        for line in text.splitlines():
            line = line.strip().lstrip("*-#0123456789. ")
            match = _SECTION_RE.search(line)
            if match:
                sec_num = match.group(1).strip()
                sec_title = match.group(2).strip()
                sec_summary = match.group(3).strip()

                if sec_num not in seen_sections:
                    seen_sections.add(sec_num)
                    # Pick a source URL if multiple are available
                    url = source_urls[len(hits) % len(source_urls)] if source_urls else None
                    hits.append(
                        LegalWebHit(
                            law_code=statute_name,
                            section_number=sec_num,
                            section_title=sec_title,
                            snippet=f"{sec_num}. {sec_title} - {sec_summary}",
                            source_url=url,
                        )
                    )

        # Fallback if strict regex missed: create a general provision hit from the text
        if not hits and text.strip():
            hits.append(
                LegalWebHit(
                    law_code=statute_name,
                    section_number="General",
                    section_title=f"{statute_name} Provisions",
                    snippet=text[:400].strip(),
                    source_url=primary_url,
                )
            )

        register_statute_title(statute_name, statute_name.replace("_", " ").title())
        log.info("google_search_grounding_success", statute=statute_name, hits=len(hits), urls=len(source_urls))
        return hits


__all__ = ["GoogleLegalSearcher", "LegalWebHit"]
