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
  expandedArticleId: Ref<number | null>
  displayedArticles: ComputedRef<readonly Article[]>
  selectedFeedId: Ref<number | null>
  showUnreadOnly: Ref<boolean>
  isKeyboardNavigating: Ref<boolean>

  // Data actions
  markAsRead: (id: number, isRead: boolean) => Promise<void>
  refreshFeed: (feedId: number) => Promise<{ success: boolean; newArticles: number }>
  syncAll: () => Promise<any>
  toggleSaveArticle: (articleId: number) => Promise<void>

  // Higher-level handlers
  handleOpenArticle: (id: number, toggle?: boolean) => Promise<void>
  handleMarkAsRead: () => Promise<void>
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const {
    helpDialogRef,
    toggleMenu,
    selectedArticleId,
    expandedArticleId,
    displayedArticles,
    selectedFeedId,
    showUnreadOnly,
    isKeyboardNavigating,
    markAsRead,
    refreshFeed,
    syncAll,
    toggleSaveArticle,
    handleOpenArticle,
    handleMarkAsRead
  } = options

  const navigateArticles = async (direction: Direction, autoExpand = false) => {
    const currentIndex = displayedArticles.value.findIndex(a => a.id === selectedArticleId.value)
    let newArticleId: number | null = null

    if (direction === 'up' && currentIndex > 0) {
      newArticleId = displayedArticles.value[currentIndex - 1].id
    } else if (direction === 'down' && currentIndex < displayedArticles.value.length - 1) {
      newArticleId = displayedArticles.value[currentIndex + 1].id
    } else if (direction === 'down' && currentIndex === displayedArticles.value.length - 1) {      
      if (autoExpand && showUnreadOnly.value) {
          selectedArticleId.value = null
          expandedArticleId.value = null
      }
      // For arrow keys, do nothing (stay on last article)
      return
    } else if (direction === 'down' && currentIndex === -1 && displayedArticles.value.length > 0) {
      // If nothing selected, select first article
      newArticleId = displayedArticles.value[0].id
    }

    if (newArticleId !== null) {
      selectedArticleId.value = newArticleId

      if (autoExpand) {
        // j/k keys: select and expand
        await handleOpenArticle(newArticleId, false) // Don't toggle, always open
      } else {
        // Arrow keys: just select and scroll
        await nextTick()
        const articleElement = document.getElementById(`article-${newArticleId}`)
        if (articleElement) {
          articleElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
        }
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

    // Navigation: j/k (auto-expand) or arrow keys (select only)
    if (key === 'j') {
      e.preventDefault()
      await navigateArticles('down', true) // j expands
      return
    }
    if (key === 'k') {
      e.preventDefault()
      await navigateArticles('up', true) // k expands
      return
    }
    if (key === 'ArrowDown') {
      e.preventDefault()
      isKeyboardNavigating.value = true
      await navigateArticles('down', false) // Arrow only selects
      // Reset flag after a short delay to allow smooth scrolling to complete
      setTimeout(() => { isKeyboardNavigating.value = false }, 500)
      return
    }
    if (key === 'ArrowUp') {
      e.preventDefault()
      isKeyboardNavigating.value = true
      await navigateArticles('up', false) // Arrow only selects
      // Reset flag after a short delay to allow smooth scrolling to complete
      setTimeout(() => { isKeyboardNavigating.value = false }, 500)
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

    // View original
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


