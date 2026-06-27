# News Pulse

News Pulse is a full-stack news intelligence application that ingests live RSS articles, extracts article text, clusters related stories with TF-IDF cosine similarity, and presents the results in a polished React dashboard.

The goal is to help a user quickly answer:

- Which stories are active right now?
- Which outlets are covering the same topic?
- Why did the model group these articles together?
- How does the clustering change when the TF-IDF similarity threshold changes?

## Product Highlights

- **Cluster board default view**: lead story plus consistent cluster cards with article count, source coverage, match strength, TF-IDF terms, summary, and latest activity time.
- **Signal map view**: optional bubble-style visualization for quick visual exploration of cluster size, source mix, and match strength.
- **Timeline view**: Gantt-style time axis where each topic appears as a duration bar from earliest to latest article, while single-article topics appear as point markers.
- **Cluster detail page**: equal-height article cards, source coverage, model evidence, match strength, and TF-IDF terms.
- **Similarity playground**: adjust the TF-IDF threshold and recompute preview clusters without overwriting saved clusters.
- **Pagination**: dense result sets, especially `All topics`, are paginated at 12 items per page.
- **Ingestion flow**: refresh trigger with visible phase states: Fetch, Extract, Score, Cluster.

## Architecture

```text
RSS feeds
  -> Python scraper and article extractor
  -> MongoDB
  -> Express API
  -> Vite React dashboard
```

### Folders

- `scraper/`: RSS fetch, article extraction, deduplication, TF-IDF clustering, MongoDB persistence.
- `backend/`: Express API for clusters, timeline data, threshold playground, and ingestion jobs.
- `frontend/`: React dashboard, filters, visualizations, detail pages, and ingestion UI.

## News Sources

The scraper currently reads:

- BBC News: `https://feeds.bbci.co.uk/news/rss.xml`
- NPR: `https://feeds.npr.org/1001/rss.xml`
- The Guardian World: `https://www.theguardian.com/world/rss`

## Clustering Approach

News Pulse uses a deterministic TF-IDF baseline:

1. Build article text from title, RSS summary, and extracted article body.
2. Vectorize articles with TF-IDF.
3. Use English stop-word removal and 1-2 word n-grams.
4. Compute pairwise cosine similarity.
5. Connect articles whose similarity is at least the threshold.
6. Treat connected components as clusters.

Default threshold:

```text
SIMILARITY_THRESHOLD=0.26
```

The UI also exposes a non-destructive threshold playground through the backend. Lower thresholds merge more articles into larger clusters; higher thresholds split stories into stricter groups.

### Why TF-IDF?

TF-IDF is explainable, fast, deterministic, and simple to defend in an assessment. It also lets the UI show the terms that helped group articles. Its limitation is semantic recall: articles can describe the same event with different vocabulary. A production improvement would add sentence embeddings plus density-based clustering such as HDBSCAN.

## Local Setup

### 1. MongoDB

Use MongoDB Atlas or local MongoDB.

Local Docker option:

```bash
docker compose up -d mongo
```

Local Homebrew option:

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### 2. Environment Files

Create `.env` files from examples if needed:

```bash
cp scraper/.env.example scraper/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Important variables:

- `MONGO_URI`: MongoDB connection string.
- `MONGO_DB`: database name, usually `news-pulse`.
- `SIMILARITY_THRESHOLD`: persisted scraper clustering threshold, default `0.26`.
- `MAX_ARTICLES_FOR_CLUSTERING`: number of recent articles used for clustering.
- `PYTHON_BIN`: Python executable used by the backend ingestion trigger.
- `SCRAPER_ENTRYPOINT`: path to `scraper/pipeline.py`.
- `VITE_API_BASE_URL`: frontend API base URL, usually `http://localhost:5050`.

### 3. Python Scraper

```bash
cd scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python pipeline.py
```

### 4. Backend API

The backend is configured to run on port `5050` locally.

```bash
cd backend
bun install
bun run dev
```

### 5. Frontend

```bash
cd frontend
bun install
bun run dev
```

Open:

```text
http://localhost:5173
```

## API Endpoints

- `GET /clusters`: saved cluster summaries.
- `GET /clusters/:id`: saved cluster detail with articles.
- `GET /clusters/playground?threshold=0.26`: recompute preview clusters in memory for the selected threshold.
- `GET /timeline`: saved clusters with timeline intensity.
- `POST /ingest/trigger`: start the Python ingestion pipeline.
- `GET /ingest/status/:jobId`: read ingestion job status.

## Verification Commands

Frontend:

```bash
cd frontend
bun run build
bun run lint
```

Backend:

```bash
cd backend
bunx tsc --noEmit
```

Scraper smoke test:

```bash
cd scraper
source .venv/bin/activate
python pipeline.py
```

## Current UX Notes

- The default dashboard is intentionally the **Cluster board**, because it is the clearest executive/product view.
- The **Signal map** is available as a secondary visual exploration mode.
- The **Timeline** is designed to communicate activity windows, not just sorted dates.
- The detail page focuses on explainability: model evidence, TF-IDF terms, source coverage, and equal-height article evidence cards.

