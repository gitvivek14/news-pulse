FROM oven/bun:1.2.20-debian

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
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
