# Constellations

Expo React Native word-chain game with a small backend for daily AI-generated
word sets.

## Project Shape

```
app/                         Expo Router entry points
src/                         React Native frontend source
packages/
  backend/                   Express backend, kept for local/Render fallback
  worker/                    Cloudflare Workers backend for hosted production
  shared/                    Types shared by frontend and backend code
assets/                      Expo icons, splash images, and static assets
scripts/                     Repo-level helper scripts
docs/                        Project documentation
```

The mobile app fetches game words from `EXPO_PUBLIC_API_URL` in the root
`.env`. For the Cloudflare Workers deployment, set it to the deployed Worker
URL:

```env
EXPO_PUBLIC_API_URL=https://constellations-backend.<your-subdomain>.workers.dev
```

The previous Render backend is still available as a fallback:

```env
EXPO_PUBLIC_API_URL=https://constellations-3ils.onrender.com
```

Do not put backend secrets in `EXPO_PUBLIC_*` variables. Expo public variables
are bundled into the client. `OPENAI_API_KEY` belongs in Cloudflare Worker
secrets, Render environment variables, or a local backend `.env` file.

## Prerequisites

- Node.js v20.19+ for Expo SDK 54
- npm
- Expo Go for quick device testing
- A Cloudflare account for hosted Worker deployment
- An OpenAI API key for AI word generation

## Install

```powershell
npm.cmd install
```

## Frontend Development

Start Expo:

```powershell
npm start
```

For physical Android testing through Expo Go:

```powershell
npm run start:tunnel
```

After changing `.env`, restart Expo with a clean Metro cache:

```powershell
npx expo start --clear --tunnel
```

## Cloudflare Worker Backend

The Worker is the intended hosted backend for this branch because it avoids the
Render free-tier cold-start delay. It exposes the same API shape as the Express
backend:

- `GET /health`
- `GET /api/game/words?wordCount=5`

Set up Cloudflare:

```powershell
npx wrangler login
npx wrangler d1 create constellations_words
```

Copy the returned `database_id` into
`packages/worker/wrangler.jsonc`, then apply the D1 schema:

```powershell
npm run db:migrate:remote --workspace @constellations/worker
```

Store the OpenAI key as a Worker secret:

```powershell
npx wrangler secret put OPENAI_API_KEY --cwd packages/worker
```

Deploy:

```powershell
npm run worker:deploy
```

Then update the root `.env` with the deployed Worker URL.

For local Worker development:

```powershell
npm run worker:dev
```

You can create `packages/worker/.dev.vars` for local-only Worker variables.
That file is ignored and must not be committed.

## Express Backend Fallback

The Express backend remains available for local development or Render fallback:

```powershell
npm run backend:dev
```

It runs on `http://localhost:3001`. Physical Android devices cannot reach a
development machine's `localhost`; use the Worker URL, Render URL, a reachable
LAN IP, or an Expo tunnel depending on the scenario.

For local Express development, configure:

```text
packages/backend/.env
```

with:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
PORT=3001
NODE_ENV=development
```

## Android Export

Use Expo Go for quick device testing:

```powershell
npm run start:tunnel
```

For an installable Android build, use EAS Build:

```powershell
npx eas login
npx eas build --platform android
```

For a production Play Store build, use the configured production profile:

```powershell
npm run build:android
```

EAS will provide a download link when the build finishes. Use the generated APK
for direct device installs, or the generated AAB for Play Store submission.
Before building, make sure `EXPO_PUBLIC_API_URL` points at the intended live
backend.

## Common Commands

| Command | Description |
| --- | --- |
| `npm start` | Start Expo |
| `npm run start:tunnel` | Start Expo with a tunnel for physical devices |
| `npm run backend:dev` | Start the local Express backend |
| `npm run backend:build` | Build the Express backend |
| `npm run worker:dev` | Start the Cloudflare Worker locally |
| `npm run worker:deploy` | Deploy the Cloudflare Worker |
| `npm.cmd run type-check` | Check frontend, backend, shared, and Worker TypeScript |
| `npm test` | Run Jest tests |

## Agent Context

Persistent notes for Codex and other coding agents live in `AGENTS.md` at the
repo root. Use that file for project-specific context, conventions, known
deployment URLs, commands, and things future chats should understand before
making changes.

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [OpenAI API Documentation](https://platform.openai.com/docs)

## License

MIT
