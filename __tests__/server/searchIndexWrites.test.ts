/** @jest-environment node */
import { fakeD1, makeEvent, D1_MAX_BOUND_PARAMS } from '~/__tests__/mocks/nitro'
import { deleteFtsRows } from '~/server/utils/searchIndex'

describe('deleteFtsRows', () => {
  it('removes every index row of a feed with more articles than D1 binds in one statement', async () => {
    const indexed = new Set<number>(Array.from({ length: 250 }, (_, i) => i + 1))
    const db = fakeD1((call) => {
      if (/DELETE FROM "ArticleFts"/.test(call.sql)) {
        for (const id of call.binds) indexed.delete(id)
      }
    })
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})

    await deleteFtsRows(makeEvent({ db }), [...indexed])

    expect(errors).not.toHaveBeenCalled()
    expect(indexed.size).toBe(0)
    for (const call of db.calls) {
      expect(call.binds.length).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS)
    }
    errors.mockRestore()
  })

  it('issues no statement for an empty list', async () => {
    const db = fakeD1()
    await deleteFtsRows(makeEvent({ db }), [])
    expect(db.calls).toHaveLength(0)
  })
})
