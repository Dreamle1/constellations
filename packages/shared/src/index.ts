export interface WordCardModel {
  id: string;
  word: string;
}

export interface GameWordsResponse {
  words: WordCardModel[];
  answer: string[];
  answerKey: string[];
  theme: string;
}
