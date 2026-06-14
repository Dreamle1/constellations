import { readFileSync } from 'fs';
import path from 'path';

const PROMPT_TEMPLATE_PATH = path.resolve(__dirname, '..', 'prompt');

function readPromptTemplate(): string {
  return readFileSync(PROMPT_TEMPLATE_PATH, 'utf8').trim();
}

function replaceToken(template: string, token: string, value: string): string {
  return template.split(token).join(value);
}

function formatRecentWords(recentWords: string[]): string {
  const uniqueWords = Array.from(
    new Set(
      recentWords
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  return uniqueWords.length > 0 ? uniqueWords.join(', ') : 'None';
}

export function createWordChainPrompt(
  wordCount: number,
  recentWords: string[] = [],
): string {
  const wordLabels = Array.from(
    { length: wordCount },
    (_, index) => `Word ${index + 1}`,
  );
  const chain = wordLabels.join(' -> ');
  const relationships = wordLabels
    .map((label, index) => {
      const neighbors = [
        index > 0 ? wordLabels[index - 1] : null,
        index < wordLabels.length - 1 ? wordLabels[index + 1] : null,
      ].filter(Boolean);

      return `${label} relates only to ${neighbors.join(' and ')}`;
    })
    .join('\n');
  const answerExample = Array.from(
    { length: wordCount },
    (_, index) => `"word${index + 1}"`,
  ).join(', ');

  let prompt = readPromptTemplate();
  prompt = replaceToken(prompt, '{{wordCount}}', String(wordCount));
  prompt = replaceToken(prompt, '{{chain}}', chain);
  prompt = replaceToken(prompt, '{{relationships}}', relationships);
  prompt = replaceToken(prompt, '{{answerExample}}', answerExample);
  prompt = replaceToken(prompt, '{{recentWords}}', formatRecentWords(recentWords));
  return prompt;
}
