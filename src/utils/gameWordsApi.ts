/**
 * API client for game word generation
 * Communicates with the backend server to fetch AI-generated words
 */

import type { GameWordsResponse } from '@constellations/shared';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface FetchWordsOptions {
  theme?: string;
  retries?: number;
  timeoutMs?: number;
}

/**
 * Fetch game words from the backend
 * Always returns 5 words
 * Throws if the backend cannot provide words
 */
export async function fetchGameWords(
  options: FetchWordsOptions = {},
): Promise<GameWordsResponse> {
  const { theme = 'constellation', retries = 1, timeoutMs = 10000 } = options;

  const params = new URLSearchParams({
    theme,
  });

  const url = `${API_BASE_URL}/api/game/words?${params}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: GameWordsResponse = await response.json();
      return data;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error fetching words';

      console.warn(
        `Failed to fetch words (attempt ${attempt + 1}/${retries + 1}): ${errorMessage}`,
      );

      if (isLastAttempt) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000),
      );
    }
  }

  throw new Error('Unable to fetch game words');
}
