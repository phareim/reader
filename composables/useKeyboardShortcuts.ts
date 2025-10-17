import { onMounted, onUnmounted, ref, type Ref, type ComputedRef } from 'vue'
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
  expandedArticleId: Ref<number | null>
  displayedArticles: ComputedRef<readonly Article[]>
  selectedFeedId: Ref<number | null>

  // Data actions
  markAsRead: (id: number, isRead: boolean) => Promise<void>
  refreshFeed: (feedId: number) => Promise<{ success: boolean; newArticles: number }>
  syncAll: () => Promise<any>
  toggleSaveArticle: (articleId: number) => Promise<void>

  // Higher-level handlers
  handleOpenArticle: (id: number, toggle?: boolean) => Promise<void>
  handleMarkAsRead: () => Promise<void>
  handleMarkAllRead: () => Promise<void>
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const {
    helpDialogRef,
    toggleMenu,
    selectedArticleId,
    expandedArticleId,
    displayedArticles,
    selectedFeedId,
    markAsRead,
    refreshFeed,
    syncAll,
    toggleSaveArticle,
    handleOpenArticle,
    handleMarkAsRead,
    handleMarkAllRead
  } = options

  // Track last key for g-combinations
  const lastKey = ref<string | null>(null)
  const lastKeyTimeout = ref<any>(null)

  const navigateArticles = async (direction: Direction) => {
    const currentIndex = displayedArticles.value.findIndex(a => a.id === selectedArticleId.value)
    let newArticleId: number | null = null

    if (direction === 'up' && currentIndex > 0) {
      newArticleId = displayedArticles.value[currentIndex - 1].id
    } else if (direction === 'down' && currentIndex < displayedArticles.value.length - 1) {
      newArticleId = displayedArticles.value[currentIndex + 1].id
    } else if (direction === 'down' && currentIndex === displayedArticles.value.length - 1) {
      // At the last article and pressing down - mark all as read
      await handleMarkAllRead()
      // 
      return
    } else if (direction === 'down' && currentIndex === -1 && displayedArticles.value.length > 0) {
      // If nothing selected, select first article
      newArticleId = displayedArticles.value[0].id
    }

    if (newArticleId !== null) {
      selectedArticleId.value = newArticleId
      await handleOpenArticle(newArticleId, false) // Don't toggle, always open
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

    // Track key for g-combinations
    if (key === 'g') {
      lastKey.value = 'g'
      clearTimeout(lastKeyTimeout.value)
      lastKeyTimeout.value = setTimeout(() => {
        lastKey.value = null
      }, 1000)
      return
    }

    // Handle g-combinations
    if (lastKey.value === 'g') {
      lastKey.value = null
      clearTimeout(lastKeyTimeout.value)

      if (key === 'i' || key === 'a') {
        // g+i or g+a: Go to all feeds
        selectedFeedId.value = null
        return
      }
      return
    }

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

    // Open/close article: o, Enter
    if (key === 'Enter') {
      e.preventDefault()
      if (selectedArticleId.value === null && displayedArticles.value.length > 0) {
        // Select and open first article if none selected
        const firstId = displayedArticles.value[0].id
        selectedArticleId.value = firstId
        await handleOpenArticle(firstId, false)
      } else if (selectedArticleId.value !== null) {
        // Toggle the currently selected article
        await handleOpenArticle(selectedArticleId.value, true)
      }
      return
    }

    // Close expanded article: Escape
    if (key === 'Escape') {
      e.preventDefault()
      if (expandedArticleId.value !== null) {
        expandedArticleId.value = null
      }
      return
    }

    // Mark as read without opening: e
    if (key === 'e' && !shiftKey) {
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

    // Mark as unread: Shift+U
    if (key === 'U' && shiftKey) {
      e.preventDefault()
      if (selectedArticleId.value !== null) {
        const article = displayedArticles.value.find(a => a.id === selectedArticleId.value)
        if (article && article.isRead) {
          await markAsRead(selectedArticleId.value, false)
        }
      }
      return
    }

    // View original: v
    if (key === 'o') {
      e.preventDefault()
      if (selectedArticleId.value !== null) {
        const article = displayedArticles.value.find(a => a.id === selectedArticleId.value)
        if (article) {
          window.open(article.url, '_blank')
        }
      }
      return
    }

    // Mark all as read: Shift+E
    if (key === 'E' && shiftKey) {
      e.preventDefault()
      await handleMarkAllRead()
      return
    }

    // Refresh current feed: r
    if (key === 'r' && !shiftKey) {
      e.preventDefault()
      if (selectedFeedId.value !== null) {
        try {
          await refreshFeed(selectedFeedId.value)
        } catch (error) {
          console.error('Failed to refresh feed:', error)
        }
      }
      return
    }

    // Refresh all feeds: Shift+R
    if (key === 'R' && shiftKey) {
      e.preventDefault()
      try {
        await syncAll()
      } catch (error) {
        console.error('Failed to sync all feeds:', error)
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
    clearTimeout(lastKeyTimeout.value)
  })
}


