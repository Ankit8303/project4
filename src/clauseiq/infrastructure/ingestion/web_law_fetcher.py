"""Internet legal fetcher — fetches, parses, and caches statutes from online official repositories.

Used as a fallback when a required statute is missing from the local database.
Fetches official PDFs/HTMLs, parses them into :class:`LawCorpus`, and saves them to
``data/laws/<statute_code>.json`` so they are permanently cached locally.
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Protocol, runtime_checkable

import httpx

from clauseiq.config import settings
from clauseiq.domain.exceptions import IngestionError
from clauseiq.domain.value_objects import get_statute_title, register_statute_title
from clauseiq.infrastructure.ingestion.law_ingestor import (
    AMENDMENT_DISCLAIMER,
    LawCorpus,
    LawSection,
)
from clauseiq.infrastructure.ingestion.pdf_parser import PyMuPDFParser
from clauseiq.logging_config import get_logger

log = get_logger(__name__)

# Official source repository mappings for known central/state statutes on IndiaCode / e-Gazette
OFFICIAL_STATUTE_SOURCES: dict[str, dict[str, str]] = {
    "ICA_1872": {
        "title": "Indian Contract Act, 1872",
        "url": "https://www.indiacode.nic.in/bitstream/123456789/2187/2/A187209.pdf",
    },
    "CPA_2019": {
        "title": "Consumer Protection Act, 2019",
        "url": "https://www.indiacode.nic.in/bitstream/123456789/15256/1/a2019-35.pdf",
    },
    "SRA_1963": {
        "title": "Specific Relief Act, 1963",
        "url": "https://www.indiacode.nic.in/bitstream/123456789/1583/1/A1963-47.pdf",
    },
    "IT_ACT_2000": {
        "title": "Information Technology Act, 2000",
        "url": "https://www.indiacode.nic.in/bitstream/123456789/13116/1/a2000-21.pdf",
    },
    "TPA_1882": {
        "title": "Transfer of Property Act, 1882",
        "url": "https://www.indiacode.nic.in/bitstream/123456789/2338/1/A1882-04.pdf",
    },
    "RERA_2016": {
        "title": "Real Estate (Regulation and Development) Act, 2016",
        "url": "https://www.indiacode.nic.in/bitstream/123456789/2158/1/a2016-16.pdf",
    },
    "IDA_1947": {
        "title": "Industrial Disputes Act, 1947",
        "url": "https://www.indiacode.nic.in/bitstream/123456789/11107/1/a1947-14.pdf",
    },
    "DPDP_2023": {
        "title": "Digital Personal Data Protection Act, 2023",
        "url": None,
    },
    "MSMED_2006": {
        "title": "Micro, Small and Medium Enterprises Development Act, 2006",
        "url": None,
    },
    "SOGA_1930": {
        "title": "Sale of Goods Act, 1930",
        "url": None,
    },
    "CA_2013": {
        "title": "Companies Act, 2013",
        "url": "https://www.indiacode.nic.in/bitstream/123456789/2114/1/201318.pdf",
    },
    "ACA_1996": {
        "title": "Arbitration and Conciliation Act, 1996",
        "url": "https://www.indiacode.nic.in/bitstream/123456789/1978/1/199626.pdf",
    },
}

STATUTE_ALIASES: dict[str, str] = {
    "ID_ACT_1947": "ID_ACT_1947",
    "ID_ACT": "ID_ACT_1947",
    "IDA_1947": "ID_ACT_1947",
    "INDUSTRIAL_DISPUTES_ACT_1947": "ID_ACT_1947",
    "INDUSTRIAL_DISPUTES_ACT": "ID_ACT_1947",
    "THE_INDUSTRIAL_DISPUTES_ACT_1947": "ID_ACT_1947",
    "INDIAN_CONTRACT_ACT_1872": "ICA_1872",
    "INDIAN_CONTRACT_ACT": "ICA_1872",
    "THE_INDIAN_CONTRACT_ACT_1872": "ICA_1872",
    "CONTRACT_ACT_1872": "ICA_1872",
    "CONSUMER_PROTECTION_ACT_2019": "CPA_2019",
    "CONSUMER_PROTECTION_ACT": "CPA_2019",
    "SPECIFIC_RELIEF_ACT_1963": "SRA_1963",
    "SPECIFIC_RELIEF_ACT": "SRA_1963",
    "INFORMATION_TECHNOLOGY_ACT_2000": "IT_ACT_2000",
    "IT_ACT": "IT_ACT_2000",
    "ITACT_2000": "IT_ACT_2000",
    "TRANSFER_OF_PROPERTY_ACT_1882": "TPA_1882",
    "TRANSFER_OF_PROPERTY_ACT": "TPA_1882",
    "REAL_ESTATE_REGULATION_AND_DEVELOPMENT_ACT_2016": "RERA_2016",
    "REAL_ESTATE_ACT_2016": "RERA_2016",
    "RERA": "RERA_2016",
    "DIGITAL_PERSONAL_DATA_PROTECTION_ACT_2023": "DPDP_2023",
    "DPDPA_2023": "DPDP_2023",
    "DPDP": "DPDP_2023",
    "MSMED_ACT_2006": "MSMED_2006",
    "MSMEDA_2006": "MSMED_2006",
    "MSMED_2006": "MSMED_2006",
    "MSMEDA": "MSMED_2006",
    "MSMED": "MSMED_2006",
    "MSME_ACT": "MSMED_2006",
    "MSMED_ACT": "MSMED_2006",
    "SALE_OF_GOODS_ACT_1930": "SOGA_1930",
    "SALE_OF_GOODS_ACT": "SOGA_1930",
    "SOGA_1930": "SOGA_1930",
    "SOGA": "SOGA_1930",
    "COMPANIES_ACT_2013": "CA_2013",
    "COMPANIES_ACT": "CA_2013",
    "ARBITRATION_AND_CONCILIATION_ACT_1996": "ACA_1996",
    "ARBITRATION_ACT_1996": "ACA_1996",
}


@runtime_checkable
class InternetLawFetcher(Protocol):
    """Protocol for fetching legal statutes over the internet."""

    async def fetch_statute(self, statute_identifier: str) -> LawCorpus | None:
        """Fetch, parse, and persist a statute from the internet into local cache."""
        ...


class OfficialPortalLawFetcher:
    """Fetches official Act documents from government portals and parses into a LawCorpus."""

    def __init__(
        self,
        *,
        laws_dir: Path | None = None,
        timeout: float = 5.0,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._laws_dir = laws_dir or settings.law_corpus_path.parent
        self._timeout = timeout
        self._http_client = http_client

    async def _download_bytes(self, url: str) -> bytes:
        if self._http_client is not None:
            response = await self._http_client.get(url)
            response.raise_for_status()
            return response.content
        async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.content

    def _parse_text_into_sections(self, text: str, statute_code: str) -> list[LawSection]:
        """Simple section parser for raw legal text (e.g. from PDF/HTML)."""
        section_re = re.compile(
            r'(?m)^[ \t]*(?:Section\s+)?(\d{1,4}[A-Za-z]?)\.\s*([^\n—\.-]+)[—\.-]\s*(.+?)(?=\n[ \t]*(?:Section\s+)?\d{1,4}[A-Za-z]?\.|\Z)',
            re.DOTALL,
        )
        sections: list[LawSection] = []
        today = date.today()
        for match in section_re.finditer(text):
            sec_num = match.group(1).strip()
            sec_title = match.group(2).strip()
            sec_body = match.group(3).strip()
            if sec_body:
                sections.append(
                    LawSection(
                        section_number=sec_num,
                        section_title=sec_title,
                        section_text=f"{sec_num}. {sec_title}.—{sec_body}",
                        source_fetched_at=today,
                        is_amendment_history_known=False,
                    )
                )

        # Fallback if regex found no structured sections: create a single overview section
        if not sections and text.strip():
            sections.append(
                LawSection(
                    section_number="1",
                    section_title=get_statute_title(statute_code),
                    section_text=text[:3000].strip(),
                    source_fetched_at=today,
                    is_amendment_history_known=False,
                )
            )
        return sections

    async def fetch_statute(self, statute_identifier: str) -> LawCorpus | None:
        """Fetch, parse, and commit an online statute corpus."""
        raw_key = statute_identifier.strip().upper()
        code_key = STATUTE_ALIASES.get(raw_key, raw_key)
        info = OFFICIAL_STATUTE_SOURCES.get(code_key)

        today = date.today()
        title = info["title"] if info else code_key.replace("_", " ").title()
        url = info["url"] if info else None

        content: bytes | None = None
        if url:
            log.info("fetching_statute_from_internet", statute=code_key, url=url)
            try:
                content = await self._download_bytes(url)
            except Exception as exc:
                log.warning("statute_web_fetch_failed", statute=code_key, url=url, error=str(exc))

        # Fallback to Google Search Grounding if official download is unavailable or failed
        if content is None:
            try:
                from clauseiq.infrastructure.search.google_search import GoogleLegalSearcher

                searcher = GoogleLegalSearcher()
                hits = await searcher.search_statute_provisions(
                    statute_identifier, ["statutory provisions", "compliance", "liabilities"]
                )
                if hits:
                    sections = [
                        LawSection(
                            section_number=hit.section_number,
                            section_title=hit.section_title,
                            section_text=hit.snippet,
                            source_fetched_at=today,
                            is_amendment_history_known=False,
                        )
                        for hit in hits
                    ]
                    source_url = hits[0].source_url or "https://www.indiacode.nic.in"
                    version = f"{code_key}-web-{today.isoformat()}"
                    corpus = LawCorpus(
                        law_code=code_key,
                        statute_title=title,
                        version=version,
                        source_url=source_url,
                        source_fetched_at=today,
                        effective_date=today,
                        disclaimer=AMENDMENT_DISCLAIMER,
                        sections=sections,
                    )
                    self._laws_dir.mkdir(parents=True, exist_ok=True)
                    out_path = self._laws_dir / f"{code_key.lower()}.json"
                    try:
                        out_path.write_text(corpus.model_dump_json(indent=2) + "\n", encoding="utf-8")
                        log.info("saved_google_search_grounded_statute", path=str(out_path), sections=len(sections))
                    except OSError as exc:
                        log.warning("failed_writing_statute_cache", path=str(out_path), error=str(exc))
                    register_statute_title(code_key, title)
                    return corpus
            except Exception as exc:
                log.warning("google_search_grounding_fallback_failed", statute=statute_identifier, error=str(exc))
            return None

        # Parse downloaded document
        today = date.today()
        version = f"{code_key}-web-{today.isoformat()}"
        try:
            doc = await PyMuPDFParser().parse(content, source_name=url)
            full_text = "\n".join(b.text for b in doc.blocks)
        except Exception:
            full_text = content.decode("utf-8", errors="ignore")

        sections = self._parse_text_into_sections(full_text, code_key)
        if not sections:
            log.warning("statute_parsing_empty_sections", statute=code_key)
            return None

        corpus = LawCorpus(
            law_code=code_key,
            statute_title=title,
            version=version,
            source_url=url,
            source_fetched_at=today,
            effective_date=today,
            disclaimer=AMENDMENT_DISCLAIMER,
            sections=sections,
        )

        # Cache to data/laws/<statute_code>.json
        self._laws_dir.mkdir(parents=True, exist_ok=True)
        out_path = self._laws_dir / f"{code_key.lower()}.json"
        try:
            out_path.write_text(corpus.model_dump_json(indent=2) + "\n", encoding="utf-8")
            log.info("saved_fetched_statute_to_local_cache", path=str(out_path), sections=len(sections))
        except OSError as exc:
            log.warning("failed_writing_statute_cache", path=str(out_path), error=str(exc))

        register_statute_title(code_key, title)
        return corpus


__all__ = [
    "InternetLawFetcher",
    "OFFICIAL_STATUTE_SOURCES",
    "OfficialPortalLawFetcher",
]
