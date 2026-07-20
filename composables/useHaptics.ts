/**
 * A single light tactile tick, for acknowledging a committed gesture.
 *
 * Android (and other Vibration-API browsers) get `navigator.vibrate`.
 * iOS Safari — including home-screen PWAs — has no Vibration API, but
 * toggling a native switch control inside a user gesture produces the
 * system's light haptic on iOS 17.4+, so we click a hidden
 * `<input type="checkbox" switch>`. Everywhere else this is a no-op;
 * haptics are garnish, so every path swallows failure.
 */

let switchEl: HTMLInputElement | null = null

function iosSwitchTick() {
  if (!switchEl || !switchEl.isConnected) {
    switchEl = document.createElement('input')
    switchEl.type = 'checkbox'
    switchEl.setAttribute('switch', '')
    switchEl.setAttribute('aria-hidden', 'true')
    switchEl.tabIndex = -1
    // Not display:none — Safari skips the haptic for non-rendered controls.
    switchEl.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;'
    document.body.appendChild(switchEl)
  }
  switchEl.click()
}

export function useHaptics() {
  const tick = () => {
    if (typeof window === 'undefined') return
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(10)
      else iosSwitchTick()
    } catch {
      // no haptics available — fine
    }
  }
  return { tick }
}
