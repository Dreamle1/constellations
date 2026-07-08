# Backend Setup

This repo has two backend implementations:

- `packages/worker` is the Cloudflare Workers backend intended for hosted production.
- `packages/backend` is the Express backend kept for local development and Render fallback.

Both expose:

- `GET /health`
- `GET /api/game/words?wordCount=5`

## Install Dependencies

```powershell
npm.cmd install
```

## Cloudflare Worker Setup

Cloudflare is the preferred hosted backend on this branch because it avoids the
Render free-tier cold-start delay.

1. Sign in:

   ```powershell
   npx wrangler login
   ```

2. Create the D1 database:

   ```powershell
   npx wrangler d1 create constellations_words
   ```

3. Copy the returned `database_id` into `packages/worker/wrangler.jsonc`.

4. Apply the schema:

   ```powershell
   npm run db:migrate:remote --workspace @constellations/worker
   ```

5. Store the OpenAI key as a Worker secret:

   ```powershell
   npx wrangler secret put OPENAI_API_KEY --cwd packages/worker
   ```

6. Deploy:

   ```powershell
   npm run worker:deploy
   ```

7. Point the Expo app at the Worker URL in the root `.env`:

   ```env
   EXPO_PUBLIC_API_URL=https://constellations-backend.<your-subdomain>.workers.dev
   ```

8. Restart Expo:

   ```powershell
   npx expo start --clear --tunnel
   ```

## Local Worker Development

Run:

```powershell
npm run worker:dev
```

For local-only variables, create `packages/worker/.dev.vars`:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Do not commit `.dev.vars`.

## Express Backend Fallback

Copy the local env template:

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

Start the Express backend:

```powershell
npm run backend:dev
```

Test it:

```powershell
curl.exe --http1.1 "http://localhost:3001/api/game/words?wordCount=5"
```

## Troubleshooting

**Cloudflare deploy fails because `database_id` is a placeholder**

Run `npx wrangler d1 create constellations_words` and copy the returned ID into
`packages/worker/wrangler.jsonc`.

**Worker returns `SERVICE_UNCONFIGURED`**

Set the secret with `npx wrangler secret put OPENAI_API_KEY --cwd packages/worker`.

**Physical Android device cannot reach local backend**

Do not use `http://localhost:3001` from a physical Android device. Point
`EXPO_PUBLIC_API_URL` at the Worker URL, Render URL, or an accessible LAN IP.

**Port 3001 already in use**

Either stop the process using that port or change `PORT` in
`packages/backend/.env`.
