CREATE TABLE IF NOT EXISTS user_ai_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'cloudflare'
    CHECK (provider IN ('cloudflare', 'gemini', 'deepseek', 'openai_compatible')),
  model TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL DEFAULT '',
  api_key_cipher TEXT,
  api_key_hint TEXT,
  updated_at TEXT NOT NULL
);
