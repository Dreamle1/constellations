# Constellations Cloudflare Worker

Cloudflare Workers backend for hosted production. It replaces the Render
Express backend as the preferred deployment target on this branch.

## Setup

1. Install dependencies from the repo root:

   ```powershell
   npm.cmd install
   ```

2. Sign in to Cloudflare:

   ```powershell
   npx wrangler login
   ```

3. Create the D1 database:

   ```powershell
   npx wrangler d1 create constellations_words
   ```

4. Copy the returned `database_id` into `packages/worker/wrangler.jsonc`.

5. Apply the schema:

   ```powershell
   npm run db:migrate:remote --workspace @constellations/worker
   ```

6. Store the OpenAI key as a Worker secret:

   ```powershell
   npx wrangler secret put OPENAI_API_KEY --cwd packages/worker
   ```

7. Deploy:

   ```powershell
   npm run worker:deploy
   ```

8. Point the Expo app at the Worker URL in the root `.env`:

   ```env
   EXPO_PUBLIC_API_URL=https://constellations-backend.<your-subdomain>.workers.dev
   ```

9. Restart Expo after changing `.env`:

   ```powershell
   npx expo start --clear --tunnel
   ```

## Endpoints

- `GET /health`
- `GET /api/game/words?wordCount=5`

## Local Development

Run the Worker locally:

```powershell
npm run worker:dev
```

For local-only variables, create `packages/worker/.dev.vars`:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Do not commit `.dev.vars`.
