# Constellations Backend

Node.js + Express backend for the Constellations game, providing AI-powered word generation using Anthropic's Claude API.

## Setup

### 1. Install Dependencies

From the root directory:
```bash
npm install
```

This installs dependencies for both the backend and shared packages due to the monorepo structure.

### 2. Configure Environment

Copy the example environment file:
```bash
cp packages/backend/.env.example packages/backend/.env
```

Then edit `packages/backend/.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=your_api_key_here
PORT=3001
```

Get your API key at: https://console.anthropic.com

## Running the Backend

### Development Mode
```bash
npm run backend:dev
```

The server will start on `http://localhost:3001` and automatically restart on file changes.

### Production Build
```bash
npm run backend:build
npm run backend:start
```

## API Endpoints

### Health Check
```
GET /health
```
Response: `{ "status": "ok" }`

### Generate Game Words
```
GET /api/game/words?count=5&theme=constellation
```

**Query Parameters:**
- `count` (optional, default: 5): Number of words to generate (max: 20)
- `theme` (optional, default: "constellation"): Theme for word generation

**Response:**
```json
{
  "words": ["star", "moon", "orbit", "nova", "comet"],
  "theme": "constellation"
}
```

**Error Handling:**
If the API call fails, the backend returns default fallback words instead of erroring out.

## Running Frontend + Backend Together

From the root directory:
```bash
npm run dev:all
```

This uses `concurrently` to run both the frontend and backend in parallel.

## Project Structure

```
packages/
  backend/
    src/
      services/       # Business logic (AI integration)
      routes/         # API route handlers
      server.ts       # Express server setup
  shared/
    src/index.ts      # Shared TypeScript types
```

## Extending the Backend

### Adding New Endpoints

1. Create a new file in `packages/backend/src/routes/`
2. Define your route handlers
3. Import and register in `src/server.ts`

### Changing the AI Provider

Currently using Anthropic Claude. To switch providers:

1. Update the dependency in `packages/backend/package.json`
2. Modify `packages/backend/src/services/wordGenerationService.ts`
3. Update the prompt/API call logic

## Type Safety

The frontend and backend share types from `@constellations/shared`. Update shared types in `packages/shared/src/index.ts` and they're automatically available in both projects.

## Deployment

### Environment Variables Required
- `ANTHROPIC_API_KEY` - Your Anthropic API key

### Production Checklist
- Set `NODE_ENV=production`
- Use `npm run backend:build` then `npm run backend:start`
- Set appropriate `PORT` variable
- Ensure `ANTHROPIC_API_KEY` is securely configured

## Troubleshooting

**"ANTHROPIC_API_KEY environment variable is not set"**
- Make sure you've created `.env` file in `packages/backend/`
- Verify the API key is correctly set in the file

**Backend not starting**
- Check that port 3001 is not in use: `lsof -i :3001` (macOS/Linux) or `netstat -ano | findstr :3001` (Windows)
- Verify Node.js version >= 18.0.0

**Type errors in shared package**
- Run `npm install` from root to ensure all packages are linked
