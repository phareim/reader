/**
 * Shared header message management for article view pages
 * Handles success and error message display with auto-dismiss
 */
export const useHeaderMessages = () => {
  const success = ref<string | null>(null)
  const error = ref<string | null>(null)

  const showSuccess = (message: string) => {
    error.value = null
    success.value = message
    setTimeout(() => {
      success.value = null
    }, 3000)
  }

  const showError = (message: string) => {
    success.value = null
    error.value = message
    setTimeout(() => {
      error.value = null
    }, 3000)
  }

  const clearMessages = () => {
    success.value = null
    error.value = null
  }

  return {
    success,
    error,
    showSuccess,
    showError,
    clearMessages
  }
}
