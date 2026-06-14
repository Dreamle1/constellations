import { Router, Request, Response } from 'express';
import {
  WordGenerationError,
  WordGenerationService,
  type GeneratedWordsResponse,
} from '../services/wordGenerationService';

interface GameWordsErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

type GameWordsRouteResponse = GeneratedWordsResponse | GameWordsErrorResponse;

const router = Router();

let wordService: WordGenerationService | null = null;

function getWordService(): WordGenerationService {
  if (!wordService) {
    wordService = new WordGenerationService();
  }
  return wordService;
}

/**
 * GET /api/game/words
 * Return the current Pacific-day words, generating and storing a new set only
 * when the database is empty or still has a previous day's words.
 */
router.get(
  '/words',
  async (
    req: Request<Record<string, never>, GameWordsRouteResponse>,
    res: Response<GameWordsRouteResponse>,
  ) => {
    try {
      const wordCount = Number(req.query.wordCount ?? 5);

      console.log('[API REQUEST]');
      console.log('  Method: GET');
      console.log('  Endpoint: /api/game/words');
      console.log('  Word Count:', wordCount);
      console.log('  Timestamp:', new Date().toISOString());

      const response = await getWordService().generateWords(wordCount);

      console.log('[API RESPONSE]');
      console.log('  Status: 200 OK');
      console.log('  Words Returned:', response.words.length);
      console.log('  Source:', response.api?.generation.source ?? 'unknown');
      console.log('---');

      res.json(response);
    } catch (error) {
      console.error('[API ERROR]');
      console.error('  Error:', error instanceof Error ? error.message : error);
      if (error instanceof WordGenerationError) {
        console.error('  Code:', error.code);
      }
      console.error('---');

      const code =
        error instanceof WordGenerationError
          ? error.code
          : 'WORD_GENERATION_FAILED';
      const message =
        error instanceof WordGenerationError
          ? error.message
          : 'Unable to generate words.';

      res.status(500).json({
        error: {
          code,
          message,
        },
      });
    }
  },
);

export default router;
