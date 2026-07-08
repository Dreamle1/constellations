CREATE TABLE IF NOT EXISTS daily_words (
  date TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  answer_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (date, word_count)
);

CREATE INDEX IF NOT EXISTS idx_daily_words_date ON daily_words (date);
