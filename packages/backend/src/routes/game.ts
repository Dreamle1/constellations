import { Router, Request, Response } from 'express';
import type {
  ApiRequestInfo,
  GeneratedWordsResponse,
} from '../services/wordGenerationService';
import { WordGenerationService } from '../services/wordGenerationService';

const router = Router();

let wordService: WordGenerationService | null = null;

function getWordService(): WordGenerationService {
  if (!wordService) {
    wordService = new WordGenerationService();
  }
  return wordService;
}

function createRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getQueryStrings(req: Request): Record<string, string> {
  return Object.fromEntries(
    Object.entries(req.query)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, value as string]),
  );
}

function getRequestInfo(req: Request, requestId: string, timestamp: string): ApiRequestInfo {
  const userAgent = req.get('user-agent');

  return {
    id: requestId,
    method: req.method,
    path: req.originalUrl,
    query: getQueryStrings(req),
    timestamp,
    ...(userAgent ? { userAgent } : {}),
    ...(req.ip ? { ip: req.ip } : {}),
  };
}

/**
 * GET /api/game/words
 * Generate random words for a new game
 *
 * Query parameters:
 * - theme: theme for word generation (default: "constellation")
 *
 * Response: JSON object with 5 words and their IDs
 */
router.get('/words', async (req: Request, res: Response<GeneratedWordsResponse>) => {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();
  const requestInfo = getRequestInfo(req, requestId, timestamp);
  const theme = typeof req.query.theme === 'string' ? req.query.theme : 'constellation';

  try {
    console.log('[API REQUEST]');
    console.log('  Request ID:', requestId);
    console.log('  Method: GET');
    console.log('  Path:', req.originalUrl);
    console.log('  Query Params:', requestInfo.query);
    console.log('  Client IP:', requestInfo.ip || 'unknown');
    console.log('  User Agent:', requestInfo.userAgent || 'unknown');
    console.log('  Timestamp:', timestamp);

    const response = await getWordService().generateWords(theme);
    const responseBody: GeneratedWordsResponse = {
      ...response,
      api: {
        ...response.api,
        request: requestInfo,
        generation: response.api?.generation ?? {
          provider: 'local',
          source: 'fallback',
          durationMs: Date.now() - startedAt,
          fallbackReason: 'missing_generation_metadata',
        },
      },
    };
    const durationMs = Date.now() - startedAt;

    console.log('[API RESPONSE]');
    console.log('  Request ID:', requestId);
    console.log('  Status: 200 OK');
    console.log('  Duration:', `${durationMs}ms`);
    console.log('  Theme:', responseBody.theme);
    console.log('  Words Generated:', responseBody.words.length);
    console.log('  Source:', responseBody.api?.generation.source);
    console.log('  Provider:', responseBody.api?.generation.provider);
    console.log('  Model:', responseBody.api?.generation.model || 'none');
    console.log('  Fallback Reason:', responseBody.api?.generation.fallbackReason || 'none');
    console.log('  Response:', JSON.stringify(responseBody, null, 2));
    console.log('---');

    res.json(responseBody);
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    console.error('[API ERROR]');
    console.error('  Request ID:', requestId);
    console.error('  Duration:', `${durationMs}ms`);
    console.error('  Error:', error instanceof Error ? error.message : error);
    console.error('---');

    res.status(500).json({
      words: [
        { id: 'card-0', word: 'star' },
        { id: 'card-1', word: 'moon' },
        { id: 'card-2', word: 'orbit' },
        { id: 'card-3', word: 'nova' },
        { id: 'card-4', word: 'comet' },
      ],
      theme,
      api: {
        request: requestInfo,
        generation: {
          provider: 'local',
          source: 'fallback',
          durationMs,
          fallbackReason: 'route_error',
          error: {
            type: error instanceof Error ? error.constructor.name : typeof error,
            message: error instanceof Error ? error.message : String(error),
          },
        },
      },
    });
  }
});

export default router;
