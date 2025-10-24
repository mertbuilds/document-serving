CREATE TABLE files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0
);
