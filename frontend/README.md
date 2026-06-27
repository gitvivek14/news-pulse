# News Pulse Frontend

React + Vite dashboard for News Pulse.

## Features

- Cluster board default view.
- Optional Signal map and Timeline views.
- Source, date, cross-source, search, and topic-scope filters.
- TF-IDF threshold playground.
- Pagination for dense result sets.
- Cluster detail pages with model evidence and equal-height article cards.

## Run

```bash
cp .env.example .env
bun install
bun run dev
```

Expected local API:

```text
VITE_API_BASE_URL=http://localhost:5050
```

## Verify

```bash
bun run build
bun run lint
```
