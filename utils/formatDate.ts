import { formatDistanceToNow } from 'date-fns'

/**
 * Format a date as a relative time string (e.g., "5 minutes ago")
 */
export const formatRelativeDate = (date?: string): string => {
  if (!date) return 'Unknown date'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'Unknown date'
  }
}
