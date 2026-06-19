# Constellations Agent Notes

## Project Shape

- This is an Expo React Native app using Expo Router.
- Frontend routes live in `app/`; most UI and logic lives in `src/`.
- The backend is an Express service in `packages/backend`.
- Shared API types live in `packages/shared`.
- The backend is deployed on Render at `https://constellations-3ils.onrender.com`.

## Environment

- Root `.env` is for Expo public frontend variables only.
- `EXPO_PUBLIC_API_URL` should point to the active backend URL.
- Backend secrets such as `OPENAI_API_KEY` must stay in Render env vars or `packages/backend/.env`.
- Do not put backend secrets in `EXPO_PUBLIC_*` variables because Expo exposes them to the client.

## Common Commands

- `npm.cmd run type-check` checks TypeScript for the frontend, backend, and shared package on Windows.
- `npm run start:tunnel` starts Expo with a tunnel for physical devices.
- `npx expo start --clear --tunnel` is useful after changing `.env` or Metro-sensitive config.
- `npm run backend:dev` starts the backend locally on port `3001`.
- `npm run backend:build` builds the backend for Render-style production execution.

## Runtime Notes

- Physical Android devices cannot reach `http://localhost:3001` on the development machine. Use the Render URL, an accessible LAN IP, or an Expo tunnel depending on the scenario.
- Render health check endpoint is `/health`.
- Game words endpoint is `/api/game/words?wordCount=5`.
- Avoid noisy frontend console logging; React Native warnings are very visible during Expo Go testing.
- Avoid logging prompts, raw model responses, or API secrets in backend logs.

## Editing Guidelines

- Keep changes scoped to the requested behavior.
- Prefer existing project patterns and TypeScript types from `packages/shared`.
- After code changes, run `npm.cmd run type-check` when practical.

## Git Workflow

- Agents may create commits and push code when the user explicitly asks.
- Do not commit or push automatically without a clear user request.
- Before committing, check the diff and avoid including unrelated local changes.
