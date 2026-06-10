/**
 * D1's `.run()` reports insert metadata under `meta` (`meta.last_row_id`,
 * `meta.changes`) — there are no top-level `lastRowId`/`changes` fields.
 * The legacy top-level reads are kept as fallbacks for test doubles.
 */
export const lastRowId = (result: any): number | null =>
  result?.meta?.last_row_id ?? result?.lastRowId ?? null

export const rowsChanged = (result: any): number =>
  result?.meta?.changes ?? result?.changes ?? 0
