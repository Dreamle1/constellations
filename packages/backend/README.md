# Constellations Express Backend

Node.js + Express backend for local development and Render fallback. The
preferred hosted backend on this branch is `packages/worker`.

## Setup

Install dependencies from the repo root:

```powershell
npm.cmd install
```

Copy the example environment file:

```powershell
copy packages\backend\.env.example packages\backend\.env
```

Edit `packages/backend/.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
PORT=3001
NODE_ENV=development
```

## Run

Development:

```powershell
npm run backend:dev
```

Production-style local run:

```powershell
npm run backend:build
npm run backend:start
```

## API

### Health Check

```text
GET /health
```

Response:

```json
{ "status": "ok" }
```

### Game Words

```text
GET /api/game/words?wordCount=5
```

Supported `wordCount` values are `5`, `7`, and `9`. Unsupported values fall
back to `5`.

Response:

```json
{
  "words": [
    { "id": "card-2", "word": "candle" },
    { "id": "card-0", "word": "spark" },
    { "id": "card-4", "word": "seal" },
    { "id": "card-1", "word": "flame" },
    { "id": "card-3", "word": "wax" }
  ],
  "answer": ["spark", "flame", "candle", "wax", "seal"],
  "answerKey": ["card-0", "card-1", "card-2", "card-3", "card-4"],
  "wordCount": 5
}
```

## Storage

The Express backend stores generated daily words in a local JSON file by
default:

```text
packages/backend/data/daily-words.json
```

Override with `WORD_STORE_PATH` if needed. This local storage is not durable on
Render free instances after restarts, which is one reason the Cloudflare Worker
uses D1 instead.

## Deployment

Render fallback configuration lives in `render.yaml`. Required production
environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `NODE_ENV=production`

Use:

```powershell
npm run backend:build
npm run backend:start
```

## Troubleshooting

**`SERVICE_UNCONFIGURED`**

Set `OPENAI_API_KEY` in `packages/backend/.env` for local development or in the
hosted environment variables for Render.

**Port 3001 already in use**

Stop the process using the port or change `PORT` in `packages/backend/.env`.

**Physical Android device cannot reach backend**

Do not point a physical Android device at `http://localhost:3001`. Use the
Cloudflare Worker URL, Render URL, a reachable LAN IP, or an Expo tunnel.
