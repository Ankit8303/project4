# Three stages: builder installs dependencies, indexer builds the law vector index
# and caches the embedding model, and runtime runs the FastAPI application.

FROM python:3.11-slim AS builder

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# README.md is not present at the repository root, so do not COPY it.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Install the project itself (src layout).
COPY src ./src
RUN uv sync --frozen --no-dev


FROM builder AS indexer

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src \
    HF_HOME=/app/.cache/huggingface \
    HF_HUB_DISABLE_XET=1
COPY data/laws ./data/laws
COPY scripts/ingest_laws.py ./scripts/ingest_laws.py
RUN python scripts/ingest_laws.py


FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    HF_HOME=/app/.cache/huggingface \
    HF_HUB_OFFLINE=1
WORKDIR /app

# Non-root runtime user.
RUN useradd --create-home --uid 1000 app

COPY --from=builder /app/.venv /app/.venv
COPY src ./src
COPY data/laws ./data/laws
COPY --from=indexer /app/data/chroma ./data/chroma
COPY --from=indexer /app/.cache/huggingface ./.cache/huggingface

RUN chown -R app:app /app
USER app

EXPOSE 8000

# Render (and most PaaS) inject $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn clauseiq.interfaces.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
