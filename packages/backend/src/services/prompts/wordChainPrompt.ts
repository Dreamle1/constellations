export const WORD_CHAIN_PROMPT = `Generate 5 words arranged in a linear chain (Word 1 -> Word 2 -> Word 3 -> Word 4 -> Word 5) where each word is related only to its immediate neighbors in the sequence. Specifically:

Word 1 relates only to Word 2
Word 2 relates only to Word 1 and Word 3
Word 3 relates only to Word 2 and Word 4
Word 4 relates only to Word 3 and Word 5
Word 5 relates only to Word 4

Ensure there are no meaningful semantic or obvious associations between non-adjacent words (e.g., Word 1 should have no clear relation to Word 3, 4, or 5; Word 2 should not relate to Word 4 or 5, etc.). The relationships between adjacent words should be clear and defensible (categorical, functional, or contextual). Do not explain the relationships unless asked.`;
