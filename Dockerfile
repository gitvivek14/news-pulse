FROM node:22-bookworm-slim

WORKDIR /app

ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl unzip python3 python3-venv python3-pip \
  && curl -fsSL https://bun.sh/install | bash \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/bun.lock ./backend/
WORKDIR /app/backend
RUN bun install --frozen-lockfile

WORKDIR /app
COPY scraper/requirements.txt ./scraper/requirements.txt
RUN python3 -m venv /app/scraper/.venv \
  && /app/scraper/.venv/bin/pip install --no-cache-dir -r /app/scraper/requirements.txt

COPY backend ./backend
COPY scraper ./scraper

WORKDIR /app/backend

ENV PYTHON_BIN=/app/scraper/.venv/bin/python
ENV SCRAPER_ENTRYPOINT=/app/scraper/pipeline.py

CMD ["bun", "run", "start"]
