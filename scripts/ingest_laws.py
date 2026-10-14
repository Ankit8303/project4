"""Bootstrap the committed law corpora into ChromaDB.

Loads all *.json statute files in ``data/laws/`` (or a specific ``--corpus``),
chunks + embeds each section, and upserts into the configured ChromaDB collection.
Idempotent: re-running upserts by stable chunk id, so it will not create duplicates.

Usage:
    uv run python scripts/ingest_laws.py [--all] [--corpus PATH] [--dir DIR]
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from clauseiq.config import settings
from clauseiq.infrastructure.ingestion.law_ingestor import (
    run_ingestion,
    run_multi_corpus_ingestion,
)
from clauseiq.logging_config import configure_logging, get_logger

log = get_logger(__name__)


def main() -> int:
    configure_logging()
    parser = argparse.ArgumentParser(description="Ingest law corpora into ChromaDB.")
    parser.add_argument(
        "--corpus",
        type=Path,
        default=None,
        help="Path to a single statute JSON corpus (e.g. data/laws/indian_contract_act_1872.json).",
    )
    parser.add_argument(
        "--dir",
        type=Path,
        default=None,
        help="Directory containing statute JSON corpora (defaults to data/laws).",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        default=True,
        help="Ingest all statute JSON corpora in the directory.",
    )
    args = parser.parse_args()

    if args.corpus:
        report = asyncio.run(run_ingestion(corpus_path=args.corpus))
    else:
        target_dir = args.dir or settings.law_corpus_path.parent
        paths = sorted(target_dir.glob("*.json"))
        report = asyncio.run(run_multi_corpus_ingestion(paths=paths))

    log.info("ingest_done", sections=report.sections, chunks=report.chunks)
    print(
        f"Ingested {report.sections} sections "
        f"({report.chunks} chunks) into collection '{settings.chroma_collection_law}'."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
