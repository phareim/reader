-- RemoveOldTagsColumn: Drop the old tags JSON column from Feed table
-- The data has been migrated to the new Tag and FeedTag tables

-- AlterTable
ALTER TABLE "Feed" DROP COLUMN "tags";
