import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { DailyWordStore } from './dailyWordStore';

describe('DailyWordStore', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'daily-word-store-'));
    filePath = path.join(tempDir, 'daily-words.json');
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it('includes current-date words in recent words', async () => {
    await writeFile(
      filePath,
      JSON.stringify({
        entries: [
          {
            date: '2026-06-13',
            wordCount: 5,
            answer: ['harvest', 'barn'],
            createdAt: '2026-06-14T04:40:45.130Z',
          },
          {
            date: '2026-06-12',
            wordCount: 7,
            answer: ['quill', 'ink'],
            createdAt: '2026-06-13T04:40:45.130Z',
          },
          {
            date: '2026-06-05',
            wordCount: 9,
            answer: ['outside', 'window'],
            createdAt: '2026-06-06T04:40:45.130Z',
          },
        ],
      }),
      'utf8',
    );

    await expect(new DailyWordStore(filePath).getRecentWords('2026-06-13', 7)).resolves.toEqual([
      'harvest',
      'barn',
      'quill',
      'ink',
    ]);
  });
});
