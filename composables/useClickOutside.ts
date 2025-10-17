/**
 * Composable for detecting clicks outside an element
 * @param handler - Function to call when clicked outside
 * @returns ref to attach to the element
 */
export function useClickOutside(handler: () => void) {
  const elementRef = ref<HTMLElement | null>(null)

  const handleClickOutside = (event: MouseEvent) => {
    if (elementRef.value && !elementRef.value.contains(event.target as Node)) {
      handler()
    }
  }

  onMounted(() => {
    document.addEventListener('mousedown', handleClickOutside)
  })

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })

  return elementRef
}
