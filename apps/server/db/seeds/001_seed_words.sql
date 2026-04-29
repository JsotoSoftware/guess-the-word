INSERT INTO words (word, language, difficulty, category, length)
VALUES
  ('perro', 'es', 'facil', 'general', 5),
  ('carta', 'es', 'facil', 'general', 5),
  ('nubes', 'es', 'facil', 'general', 5),
  ('queso', 'es', 'facil', 'general', 5),
  ('bosque', 'es', 'medio', 'general', 6),
  ('frutas', 'es', 'medio', 'general', 6),
  ('planeta', 'es', 'medio', 'general', 7),
  ('cosecha', 'es', 'medio', 'general', 7)
ON CONFLICT (word, language) DO NOTHING;
