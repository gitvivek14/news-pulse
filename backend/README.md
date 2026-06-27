# News Pulse Backend

Express API for News Pulse clusters, timeline data, threshold playground previews, and ingestion jobs.

## Run

```bash
cp .env.example .env
bun install
bun run dev
```

The backend expects MongoDB through `MONGO_URI`.

Local default:

```text
PORT=5050
MONGO_DB=news-pulse
```

## Endpoints

- `GET /clusters`
- `GET /clusters/:id`
- `GET /clusters/playground?threshold=0.26`
- `GET /timeline`
- `POST /ingest/trigger`
- `GET /ingest/status/:jobId`

## Verify

```bash
bunx tsc --noEmit
```
