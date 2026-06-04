import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

import type { WordItem } from './wordGenerationService';

export interface StoredDailyWords {
  date: string;
  theme: string;
  words: WordItem[];
  answer: string[];
  answerKey: string[];
  createdAt: string;
}

export class DailyWordStore {
  constructor(
    private readonly filePath = process.env.WORD_STORE_PATH ||
      path.resolve(process.cwd(), 'data', 'daily-words.json'),
  ) {}

  async getCurrent(date: string): Promise<StoredDailyWords | null> {
    const stored = await this.read();

    if (!stored || stored.date !== date || stored.words.length === 0) {
      return null;
    }

    return stored;
  }

  async save(entry: StoredDailyWords): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  }

  private async read(): Promise<StoredDailyWords | null> {
    try {
      const text = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(text) as Partial<StoredDailyWords>;

      if (
        typeof parsed.date !== 'string' ||
        typeof parsed.theme !== 'string' ||
        !Array.isArray(parsed.words) ||
        !Array.isArray(parsed.answer) ||
        !Array.isArray(parsed.answerKey) ||
        typeof parsed.createdAt !== 'string'
      ) {
        return null;
      }

      return {
        date: parsed.date,
        theme: parsed.theme,
        words: parsed.words.filter(
          (item): item is WordItem =>
            typeof item?.id === 'string' && typeof item.word === 'string',
        ),
        answer: parsed.answer.filter((word): word is string => typeof word === 'string'),
        answerKey: parsed.answerKey.filter((id): id is string => typeof id === 'string'),
        createdAt: parsed.createdAt,
      };
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      if (code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
