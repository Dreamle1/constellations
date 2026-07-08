# Monorepo Guide

This project is organized as an npm workspace monorepo.

## Structure

```
app/                         Expo Router app directory
src/                         React Native frontend source
packages/
  backend/                   Express backend for local/Render fallback
  worker/                    Cloudflare Workers backend for hosted production
  shared/                    Shared TypeScript API types
package.json                 Root workspace configuration
```

## Install

```powershell
npm.cmd install
```

This installs dependencies for the root app and every package under
`packages/*`.

## Packages

### Frontend

The Expo app calls the backend through `src/utils/gameWordsApi.ts` using
`EXPO_PUBLIC_API_URL` from the root `.env`.

### `packages/worker`

Cloudflare Workers backend. This is the preferred hosted backend on this
branch. It uses:

- Worker `fetch` handler instead of Express
- Cloudflare D1 for daily word storage
- Cloudflare Worker secrets for `OPENAI_API_KEY`

### `packages/backend`

Express backend retained for local development and Render fallback. It uses a
local filesystem daily-word cache unless configured otherwise.

### `packages/shared`

Shared API response types imported by the frontend and backend code:

```typescript
import type { GameWordsResponse, WordCardModel } from '@constellations/shared';
```

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start Expo frontend |
| `npm run start:tunnel` | Start Expo with a tunnel |
| `npm run backend:dev` | Start Express backend in watch mode |
| `npm run backend:build` | Build Express backend |
| `npm run worker:dev` | Start Cloudflare Worker locally |
| `npm run worker:deploy` | Deploy Cloudflare Worker |
| `npm.cmd run type-check` | Check frontend, backend, shared, and Worker TypeScript |
| `npm test` | Run Jest tests |

## Backend URLs

Use the Cloudflare Worker URL for hosted app builds:

```env
EXPO_PUBLIC_API_URL=https://constellations-backend.<your-subdomain>.workers.dev
```

Render fallback:

```env
EXPO_PUBLIC_API_URL=https://constellations-3ils.onrender.com
```

Local Express development:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

Physical Android devices cannot reach the development machine's `localhost`.
Use the Worker URL, Render URL, a reachable LAN IP, or an Expo tunnel.

## Cloudflare Setup

```powershell
npx wrangler login
npx wrangler d1 create constellations_words
npm run db:migrate:remote --workspace @constellations/worker
npx wrangler secret put OPENAI_API_KEY --cwd packages/worker
npm run worker:deploy
```

Copy the D1 `database_id` returned by Cloudflare into
`packages/worker/wrangler.jsonc` before migrating or deploying.

## Type Safety

Run:

```powershell
npm.cmd run type-check
```

The root Expo `tsconfig.json` excludes backend runtime packages so the frontend
compiler does not need Cloudflare or Node runtime globals. Each package is
checked by its own `tsconfig.json`.
