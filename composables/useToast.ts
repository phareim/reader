/**
 * Composable for managing toast notifications (success/error messages)
 * Extracted from pages/article/[id].vue for reusability
 */

import { ref } from 'vue'

export interface ToastOptions {
  duration?: number // Duration in milliseconds before auto-dismiss
}

/**
 * Composable for displaying temporary success/error messages
 */
export function useToast() {
  const success = ref<string | null>(null)
  const error = ref<string | null>(null)

  let successTimeout: NodeJS.Timeout | null = null
  let errorTimeout: NodeJS.Timeout | null = null

  /**
   * Show a success message
   */
  function showSuccess(message: string, options: ToastOptions = {}) {
    const { duration = 3000 } = options

    // Clear error message and any existing success timeout
    error.value = null
    if (successTimeout) {
      clearTimeout(successTimeout)
    }

    success.value = message

    // Auto-dismiss after duration
    if (duration > 0) {
      successTimeout = setTimeout(() => {
        success.value = null
        successTimeout = null
      }, duration)
    }
  }

  /**
   * Show an error message
   */
  function showError(message: string, options: ToastOptions = {}) {
    const { duration = 3000 } = options

    // Clear success message and any existing error timeout
    success.value = null
    if (errorTimeout) {
      clearTimeout(errorTimeout)
    }

    error.value = message

    // Auto-dismiss after duration
    if (duration > 0) {
      errorTimeout = setTimeout(() => {
        error.value = null
        errorTimeout = null
      }, duration)
    }
  }

  /**
   * Clear all messages
   */
  function clearAll() {
    success.value = null
    error.value = null

    if (successTimeout) {
      clearTimeout(successTimeout)
      successTimeout = null
    }
    if (errorTimeout) {
      clearTimeout(errorTimeout)
      errorTimeout = null
    }
  }

  /**
   * Clear success message only
   */
  function clearSuccess() {
    success.value = null
    if (successTimeout) {
      clearTimeout(successTimeout)
      successTimeout = null
    }
  }

  /**
   * Clear error message only
   */
  function clearError() {
    error.value = null
    if (errorTimeout) {
      clearTimeout(errorTimeout)
      errorTimeout = null
    }
  }

  return {
    success,
    error,
    showSuccess,
    showError,
    clearAll,
    clearSuccess,
    clearError
  }
}
