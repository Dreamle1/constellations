# Monorepo Setup Guide

This project is organized as a monorepo with multiple packages managed via npm workspaces.

## Project Structure

```
constellations/
├── app/                          # Expo Router app directory
├── src/                          # Frontend source code
│   ├── components/
│   ├── hooks/
│   ├── screens/
│   ├── types/
│   └── utils/
├── packages/
│   ├── backend/                  # Node.js/Express backend server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── server.ts
│   │   └── package.json
│   └── shared/                   # Shared TypeScript types
│       ├── src/
│       └── package.json
└── package.json                  # Root workspace configuration
```

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

This automatically installs dependencies for:
- Root workspace
- `packages/backend`
- `packages/shared`

npm workspaces handles symlink resolution automatically.

### 2. Configure Backend

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## Running the Project

### Frontend Only
```bash
npm start              # or npm run dev
```

### Backend Only
```bash
npm run backend:dev
```

### Both Together (Recommended for development)
```bash
npm run dev:all
```

This runs:
- Frontend on port 8081 (Expo)
- Backend on port 3001 (Express)

## Type Safety

Both frontend and backend import types from `@constellations/shared`:

```typescript
import type { WordCardModel, GameWordsResponse } from '@constellations/shared';
```

When you add new types to `packages/shared/src/index.ts`, they're automatically available in both projects without any build step needed.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo frontend |
| `npm run dev` | Start Expo in dev client mode |
| `npm run backend:dev` | Start backend in watch mode |
| `npm run dev:all` | Run frontend and backend together |
| `npm run type-check` | Check types in all packages |
| `npm run lint` | Lint all TypeScript files |
| `npm run format` | Format code with Prettier |

## Frontend-Backend Communication

The frontend calls the backend API using `fetchGameWords()` from `src/utils/gameWordsApi.ts`:

```typescript
import { fetchGameWords } from '@/utils/gameWordsApi';

const words = await fetchGameWords({ count: 5, theme: 'constellation' });
```

By default, it connects to `http://localhost:3001` in development.

## Adding New Packages

To add a new package to the monorepo:

1. Create a new directory under `packages/`
2. Add a `package.json` with a unique `name` field
3. npm workspaces will automatically link it

Example:
```bash
mkdir packages/utils
# Add package.json to packages/utils/
npm install  # This will link the new package
```

## Troubleshooting

**"Cannot find module '@constellations/shared'"**
- Run `npm install` from the root directory
- Verify the path is correct in `tsconfig.json`

**Backend won't start**
- Check `packages/backend/.env` exists and has `ANTHROPIC_API_KEY`
- Ensure port 3001 is available

**Types aren't updating**
- Backend and frontend share types in real-time
- No build step needed for shared types (TypeScript development mode)

## Next Steps

- [Backend README](./packages/backend/README.md) - API documentation and backend setup
- Add more packages as needed (e.g., `packages/cli`, `packages/common`)
