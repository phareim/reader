/**
 * Get or create a tag by name for a user, returning the tag ID.
 */
export const getOrCreateTag = async (db: any, userId: number, tagName: string): Promise<number> => {
  await db.prepare(
    'INSERT OR IGNORE INTO "Tag" (user_id, name) VALUES (?, ?)'
  ).bind(userId, tagName).run()

  const tag = await db.prepare(
    'SELECT id FROM "Tag" WHERE user_id = ? AND name = ?'
  ).bind(userId, tagName).first()

  return tag.id as number
}
