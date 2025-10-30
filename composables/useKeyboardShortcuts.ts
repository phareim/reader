import { onMounted, onUnmounted, ref, nextTick, type Ref, type ComputedRef } from 'vue'
import type { Article } from '~/types'

type Direction = 'up' | 'down'

interface HelpDialogRef {
  open: () => void
  isOpen: boolean
}

interface UseKeyboardShortcutsOptions {
  // UI refs/actions
  helpDialogRef: Ref<HelpDialogRef | null>
  toggleMenu: () => void

  // Selection and articles
  selectedArticleId: Ref<number | null>
  displayedArticles: ComputedRef<readonly Article[]>
  selectedFeedId: Ref<number | null>
  showUnreadOnly: Ref<boolean>

  // Data actions
  markAsRead: (id: number, isRead: boolean) => Promise<void>
  refreshFeed: (feedId: number) => Promise<{ success: boolean; newArticles: number }>
  syncAll: () => Promise<any>
  toggleSaveArticle: (articleId: number) => Promise<void>

  // Higher-level handlers
  handleMarkAsRead: () => Promise<void>
  handleMarkAllRead: () => Promise<void>
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const {
    helpDialogRef,
    toggleMenu,
    selectedArticleId,
    displayedArticles,
    selectedFeedId,
    showUnreadOnly,
    markAsRead,
    refreshFeed,
    syncAll,
    toggleSaveArticle,
    handleMarkAsRead,
    handleMarkAllRead
  } = options

  const navigateArticles = async (direction: Direction) => {
    const currentIndex = displayedArticles.value.findIndex(a => a.id === selectedArticleId.value)
    let newArticleId: number | null = null

    if (direction === 'up' && currentIndex > 0) {
      newArticleId = displayedArticles.value[currentIndex - 1].id
    } else if (direction === 'down' && currentIndex < displayedArticles.value.length - 1) {
      newArticleId = displayedArticles.value[currentIndex + 1].id
    } else if (direction === 'down' && currentIndex === -1 && displayedArticles.value.length > 0) {
      // If nothing selected, select first article
      newArticleId = displayedArticles.value[0].id
    }

    if (newArticleId !== null) {
      selectedArticleId.value = newArticleId

      // Scroll to the selected card
      await nextTick()
      const articleCard = document.getElementById(`article-card-${newArticleId}`)
      if (articleCard) {
        articleCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }
    }
  }

  const handleKeydown = async (e: KeyboardEvent) => {
    // Ignore if typing in an input field
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return
    }

    // Ignore if help dialog is open (except for Escape)
    if (helpDialogRef.value?.isOpen && e.key !== 'Escape') {
      return
    }

    const key = e.key
    const shiftKey = e.shiftKey

    // Navigation: j/k or arrow keys
    if (key === 'j' || key === 'ArrowDown') {
      e.preventDefault()
      await navigateArticles('down')
      return
    }
    if (key === 'k' || key === 'ArrowUp') {
      e.preventDefault()
      await navigateArticles('up')
      return
    }

    // Open article in full view: Enter or o
    if (key === 'Enter' || key === 'o') {
      e.preventDefault()
      if (selectedArticleId.value === null && displayedArticles.value.length > 0) {
        // Navigate to first article if none selected
        const firstId = displayedArticles.value[0].id
        window.location.href = `/article/${firstId}`
      } else if (selectedArticleId.value !== null) {
        // Navigate to selected article
        window.location.href = `/article/${selectedArticleId.value}`
      }
      return
    }

    // Mark all as read: Shift+A
    if (key === 'A' && shiftKey) {
      e.preventDefault()
      await handleMarkAllRead()
      return
    }

    // Mark as read without opening: e
    if (key === 'e') {
      e.preventDefault()
      await handleMarkAsRead()
      return
    }

    // Toggle menu: m
    if (key === 'm' && !shiftKey) {
      e.preventDefault()
      toggleMenu()
      return
    }

    // Save/unsave article: s
    if (key === 's' && !shiftKey) {
      e.preventDefault()
      if (selectedArticleId.value !== null) {
        await toggleSaveArticle(selectedArticleId.value)
      }
      return
    }

    // Show help: ?
    if (key === '?' || (key === '/' && shiftKey)) {
      e.preventDefault()
      helpDialogRef.value?.open()
      return
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}


