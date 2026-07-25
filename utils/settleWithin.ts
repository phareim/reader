/**
 * Race a promise against a timeout and always resolve — never reject.
 *
 * The safety net for awaiting a motion-v animation: motion-dom's
 * `JSAnimation.finished` never settles when the animation is *stopped* (a
 * pointer re-grab, a component teardown mid-fling), so a bare `await` can wedge
 * the caller's `busy` guard forever. Every caller here only wants "the fling has
 * either finished or taken long enough that we should move on".
 */
export const ANIMATION_SAFETY_MS = 1200

export function settleWithin(p: Promise<unknown>, ms: number = ANIMATION_SAFETY_MS): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    p.then(
      () => { clearTimeout(t); resolve() },
      () => { clearTimeout(t); resolve() },
    )
  })
}
