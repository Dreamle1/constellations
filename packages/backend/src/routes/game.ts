import { Router, Request, Response } from 'express';
import type { GeneratedWordsResponse } from '../services/wordGenerationService';
import { WordGenerationService } from '../services/wordGenerationService';

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
    _req: Request<Record<string, never>, GeneratedWordsResponse>,
    res: Response<GeneratedWordsResponse>,
  ) => {
    try {
      console.log('[API REQUEST]');
      console.log('  Method: GET');
      console.log('  Endpoint: /api/game/words');
      console.log('  Timestamp:', new Date().toISOString());

      const response = await getWordService().generateWords();

      console.log('[API RESPONSE]');
      console.log('  Status: 200 OK');
      console.log('  Words Returned:', response.words.length);
      console.log('  Source:', response.api?.generation.source ?? 'unknown');
      console.log('---');

      res.json(response);
    } catch (error) {
      console.error('[API ERROR]');
      console.error('  Error:', error instanceof Error ? error.message : error);
      console.error('---');

      res.status(500).json({
        words: [],
        answer: [],
        answerKey: [],
      });
    }
  },
);

export default router;
