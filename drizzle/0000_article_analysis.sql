CREATE TABLE article_analysis (
  article_id TEXT PRIMARY KEY NOT NULL,
  ticket TEXT NOT NULL UNIQUE,
  article_json TEXT NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  result_json TEXT
);
--> statement-breakpoint
CREATE INDEX article_analysis_started_at ON article_analysis (started_at);
