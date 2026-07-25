import { settleWithin, ANIMATION_SAFETY_MS } from '../../utils/settleWithin'

describe('settleWithin', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('resolves as soon as the promise resolves, without waiting out the timeout', async () => {
    let done = false
    const p = settleWithin(Promise.resolve('fling finished')).then(() => { done = true })
    await Promise.resolve()
    await p
    expect(done).toBe(true)
    // The timeout must have been cleared, not merely ignored.
    expect(jest.getTimerCount()).toBe(0)
  })

  it('resolves — never rejects — when the awaited animation rejects', async () => {
    const p = settleWithin(Promise.reject(new Error('animation stopped')))
    await expect(p).resolves.toBeUndefined()
    expect(jest.getTimerCount()).toBe(0)
  })

  it('resolves on the timeout when the promise never settles', async () => {
    // The real case: motion-dom's JSAnimation.finished never settles when the
    // animation is stopped mid-fling. Without the timeout, `busy` wedges.
    let done = false
    settleWithin(new Promise(() => {})).then(() => { done = true })
    expect(done).toBe(false)
    jest.advanceTimersByTime(ANIMATION_SAFETY_MS)
    await Promise.resolve()
    expect(done).toBe(true)
  })

  it('honours a custom timeout', async () => {
    let done = false
    settleWithin(new Promise(() => {}), 50).then(() => { done = true })
    jest.advanceTimersByTime(49)
    await Promise.resolve()
    expect(done).toBe(false)
    jest.advanceTimersByTime(1)
    await Promise.resolve()
    expect(done).toBe(true)
  })
})
