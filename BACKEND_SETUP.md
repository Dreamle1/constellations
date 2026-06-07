# Backend Setup Instructions

Your backend has been created! Follow these steps to get started:

## 1. Install Dependencies

```bash
npm install
```

This installs dependencies for the entire monorepo, including the backend and shared packages.

## 2. Get an Anthropic API Key

Visit https://console.anthropic.com and create an account to get your API key.

## 3. Configure the Backend

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-xxxx...  # Paste your Anthropic API key
PORT=3001
NODE_ENV=development
```

## 4. Start the Backend

```bash
npm run backend:dev
```

The server will start on `http://localhost:3001` and auto-reload on changes.

### Test the Backend

Open a new terminal and test the API:

```bash
curl "http://localhost:3001/api/game/words"
```

You should see a JSON response with 5 random words.

## 5. Start Frontend + Backend Together

```bash
npm run dev:all
```

This runs both the frontend (Expo) and backend (Express) simultaneously.

## Project Files Created

### Backend
- `packages/backend/src/server.ts` - Express server setup
- `packages/backend/src/routes/game.ts` - API routes for word generation
- `packages/backend/src/services/wordGenerationService.ts` - AI integration with Claude
- `packages/backend/package.json` - Backend dependencies
- `packages/backend/.env.example` - Environment template

### Shared Types
- `packages/shared/src/index.ts` - Shared TypeScript interfaces
- Used by both frontend and backend for type safety

### Frontend Integration
- `src/utils/gameWordsApi.ts` - Client for calling the backend
- Updated `src/types/cards.ts` to import from shared types
- Updated `tsconfig.json` with workspace paths

### Configuration
- Updated root `package.json` with workspaces and scripts
- `MONOREPO.md` - Complete monorepo documentation
- `packages/backend/README.md` - Backend API documentation

## Next: Update ConstellationBoard Component

Update `src/components/ConstellationBoard.tsx` to use the API instead of hardcoded words:

```typescript
import { fetchGameWords } from '@/utils/gameWordsApi';

// In your component:
const [words, setWords] = useState<string[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchGameWords()
    .then(setWords)
    .finally(() => setLoading(false));
}, []);

if (loading) {
  return <Text>Loading game...</Text>;
}

// Use words in your game logic
```

## Troubleshooting

**Cannot find module '@constellations/shared'**
- Run `npm install` from the root directory
- Restart your IDE's TypeScript server (Cmd+Shift+P → "TypeScript: Restart TS Server")

**ANTHROPIC_API_KEY not found**
- Create `packages/backend/.env` file (copy from `.env.example`)
- Add your API key to the file

**Port 3001 already in use**
- Kill the process: `lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9`
- Or change `PORT` in `packages/backend/.env`

## Documentation

- [MONOREPO.md](./MONOREPO.md) - Monorepo structure and setup
- [packages/backend/README.md](./packages/backend/README.md) - Backend API docs
