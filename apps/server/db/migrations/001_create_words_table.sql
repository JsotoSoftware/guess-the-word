CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'es',
  difficulty TEXT NULL,
  category TEXT NULL,
  length INTEGER NOT NULL CHECK (length > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT words_word_language_unique UNIQUE (word, language)
);

CREATE INDEX IF NOT EXISTS words_length_is_active_idx
  ON words (length, is_active);
