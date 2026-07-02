-- Reading position: how far down the article the reader last was, as a
-- fraction of the scrollable height (0..1). Saved debounced while reading,
-- restored when re-entering an article started earlier.
ALTER TABLE "Article" ADD COLUMN read_progress REAL NOT NULL DEFAULT 0;
