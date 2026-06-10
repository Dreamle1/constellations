import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export interface StoredDailyWords {
  date: string;
  wordCount: number;
  answer: string[];
  createdAt: string;
}

interface StoredDailyWordCollection {
  entries: StoredDailyWords[];
}

export class DailyWordStore {
  constructor(
    private readonly filePath = process.env.WORD_STORE_PATH ||
      path.resolve(process.cwd(), 'data', 'daily-words.json'),
  ) {}

  async getCurrent(date: string, wordCount: number): Promise<StoredDailyWords | null> {
    const stored = await this.read();

    const entry = stored.find(
      (item) =>
        item.date === date &&
        item.wordCount === wordCount &&
        item.answer.length === wordCount,
    );

    if (!entry) {
      return null;
    }

    return entry;
  }

  async save(entry: StoredDailyWords): Promise<void> {
    const stored = await this.read();
    const nextEntries = stored.filter(
      (item) => item.date !== entry.date || item.wordCount !== entry.wordCount,
    );

    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      `${JSON.stringify({ entries: [...nextEntries, entry] }, null, 2)}\n`,
      'utf8',
    );
  }

  private async read(): Promise<StoredDailyWords[]> {
    try {
      const text = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(text) as
        | Partial<StoredDailyWords>
        | Partial<StoredDailyWordCollection>;

      if ('entries' in parsed && Array.isArray(parsed.entries)) {
        return parsed.entries
          .map((entry) => this.normalizeEntry(entry))
          .filter((entry): entry is StoredDailyWords => Boolean(entry));
      }

      const legacyEntry = this.normalizeEntry(parsed);
      return legacyEntry ? [legacyEntry] : [];
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      if (code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private normalizeEntry(value: unknown): StoredDailyWords | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const parsed = value as Partial<StoredDailyWords>;
    if (
      typeof parsed.date !== 'string' ||
      !Array.isArray(parsed.answer) ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null;
    }

    const wordCount =
      typeof parsed.wordCount === 'number' ? parsed.wordCount : parsed.answer.length;

    return {
      date: parsed.date,
      wordCount,
      answer: parsed.answer.filter((word): word is string => typeof word === 'string'),
      createdAt: parsed.createdAt,
    };
  }
}
