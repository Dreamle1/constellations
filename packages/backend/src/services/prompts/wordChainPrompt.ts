export function createWordChainPrompt(wordCount: number): string {
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
  const answerKeyExample = Array.from(
    { length: wordCount },
    (_, index) => index + 1,
  ).join(', ');

  return `Generate ${wordCount} words arranged in a linear chain (${chain}) where each word is related only to its immediate neighbors in the sequence. Specifically:

${relationships}

Ensure there are no meaningful semantic or obvious associations between non-adjacent words. For example, Word 1 should have no clear relation to Word 3 or any later word, and each middle word should only clearly connect to the word immediately before it and immediately after it. The relationships between adjacent words should be clear and defensible (categorical, functional, or contextual).

Return only valid JSON in this exact shape:
{
  "answer": [${answerExample}],
  "answerKey": [${answerKeyExample}]
}

The answer array must contain exactly ${wordCount} unique lowercase words in the correct chain order. The answerKey array must identify that same order by 1-based answer positions. Do not include explanations, markdown, numbering outside JSON, or extra keys.`;
}
