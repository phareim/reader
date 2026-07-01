-- Persist the SFL idea an elevate creates, so undo can delete the right idea
-- without trusting a client-supplied id (mirrors Highlight.sfl_idea_id).
-- Only set when the elevate actually created the idea (SFL returned !existing);
-- a pre-existing idea is not ours to delete, so we leave this NULL for those.
ALTER TABLE "Article" ADD COLUMN sfl_idea_id TEXT;
