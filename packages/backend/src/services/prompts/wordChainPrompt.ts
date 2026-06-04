export const WORD_CHAIN_PROMPT = `Generate 5 words arranged in a linear chain (Word 1 -> Word 2 -> Word 3 -> Word 4 -> Word 5) where each word is related only to its immediate neighbors in the sequence. Specifically:

Word 1 relates only to Word 2
Word 2 relates only to Word 1 and Word 3
Word 3 relates only to Word 2 and Word 4
Word 4 relates only to Word 3 and Word 5
Word 5 relates only to Word 4

Ensure there are no meaningful semantic or obvious associations between non-adjacent words (e.g., Word 1 should have no clear relation to Word 3, 4, or 5; Word 2 should not relate to Word 4 or 5, etc.). The relationships between adjacent words should be clear and defensible (categorical, functional, or contextual).

Return only valid JSON in this exact shape:
{
  "answer": ["word1", "word2", "word3", "word4", "word5"],
  "answerKey": [1, 2, 3, 4, 5]
}

The answer array must be the correct chain order. The answerKey array must identify that same order by 1-based answer positions. Do not include explanations, markdown, numbering outside JSON, or extra keys.`;
