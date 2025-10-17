<template>
  <div>
    <!-- Slide-in Menu -->
    <div
      class="fixed top-0 left-0 h-full w-full md:w-80 bg-white dark:bg-zinc-900 shadow-2xl z-30 flex flex-col transition-transform duration-300 ease-in-out"
      :class="isOpen ? 'translate-x-0' : '-translate-x-full'">
      <!-- Menu Header -->
      <div class="flex items-center justify-between px-6 py-4 h-16 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
        <button
          @click="isOpen = false"
          class="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-900 dark:text-gray-100"
          aria-label="Close menu"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Vibe Reader</h2>
        <img v-if="session?.user?.image" :src="session.user.image" :alt="session.user.name"
          class="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-zinc-700" />
        <div v-else
          class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 dark:from-blue-600 dark:to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
          {{ session?.user?.name?.charAt(0) || '?' }}
        </div>
      </div>

      <!-- Scrollable Menu Content -->
      <div class="flex-1 overflow-y-auto p-2 space-y-3">
        <!-- Add Feed Section -->
        <div class="space-y-2">
          <input v-model="newFeedUrl" type="url" placeholder="Enter URL (feed or website)"
            class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            @keyup.enter="handleDiscoverOrAddFeed" />
          <Transition name="fade-scale">
            <div v-if="newFeedUrl.trim() !== ''" class="flex gap-2 items-center justify-between w-full overflow-hidden">
              <button @click="handleDiscoverFeeds" :disabled="!newFeedUrl.trim() || discovering"
                class="flex-1 px-3 py-1.5 text-sm bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {{ discovering ? 'Discovering...' : 'Discover' }}
              </button>
              <button @click="handleAddFeed" :disabled="!newFeedUrl.trim() || loading"
                class="flex-1 px-3 py-1.5 text-sm bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {{ loading ? 'Adding...' : 'Add Direct' }}
              </button>
            </div>
          </Transition>
          <p v-if="error" class="text-sm text-red-500 dark:text-red-400">{{ error }}</p>
          <p v-if="success" class="text-sm text-green-500 dark:text-green-400">{{ success }}</p>

          <!-- Discovered Feeds List -->
          <div v-if="discoveredFeeds.length > 0"
            class="mt-3 space-y-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <h4 class="text-sm font-semibold text-purple-900 dark:text-purple-300">Discovered Feeds:</h4>
            <div class="space-y-1">
              <button v-for="(feed, index) in discoveredFeeds" :key="index" @click="addDiscoveredFeed(feed.url)"
                class="w-full text-left px-3 py-2 text-sm bg-white dark:bg-zinc-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-700 transition-colors">
                <div class="font-medium text-purple-900 dark:text-purple-300">{{ feed.title }}</div>
                <div class="text-xs text-purple-600 dark:text-purple-400 truncate">{{ feed.url }}</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Saved Articles -->
        <button @click="selectSavedArticles"
          class="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2"
          :class="selectedFeedId === -1 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'">
          <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
          </svg>
          <span class="flex-1">Saved Articles</span>
          <span v-if="savedCount > 0"
            class="flex-shrink-0 text-xs bg-yellow-500 dark:bg-yellow-600 text-white px-2 py-0.5 rounded-full">{{
            savedCount }}</span>
        </button>

        <!-- Feeds List -->
        <div class="space-y-3">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-between">
            Feeds ({{ feeds.length }})
            <label class="space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input v-model="showUnreadOnly" type="checkbox" />
              <span class="truncate">Show unread only</span>
            </label>
          </h3>

          <div v-if="feeds.length === 0" class="text-sm text-gray-500 dark:text-gray-400">No feeds yet</div>

          <div v-else class="space-y-1">
            <!-- Tag Folders -->
            <div v-for="tag in allTags" :key="tag" v-show="!showUnreadOnly || getTagUnreadCount(tag) > 0"
              class="space-y-0">
              <!-- Tag Header (Collapsible) -->
              <div class="flex items-center gap-1 relative">
                <div
                  class="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded transition-colors group"
                  :class="selectedTag === tag && selectedFeedId === null ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'">
                  <button @click.stop="toggleTagFolderOnly(tag)"
                    class="p-0.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors">
                    <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': openTags.has(tag) }" fill="none"
                      stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button @click="selectTag(tag)" class="flex-1 text-left">
                    #{{ tag }}
                  </button>
                  <span class="text-xs bg-purple-500 dark:bg-purple-600 text-white px-2 py-0.5 rounded-full">
                    {{ getTagUnreadCount(tag) }}
                  </span>
                </div>

                <!-- Tag Dropdown Button -->
                <div class="relative">
                  <button @click.stop="toggleTagMenu(tag)"
                    class="flex-shrink-0 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                    :class="{ 'bg-gray-100 dark:bg-zinc-800': openTagMenuId === tag }">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <!-- Tag Dropdown Menu -->
                  <Transition name="dropdown">
                    <div v-if="openTagMenuId === tag"
                      class="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50">
                      <button @click="handleMarkTagAsRead(tag)"
                        class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Mark all as read</span>
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Feeds under this tag -->
              <Transition name="expand">
                <div v-if="openTags.has(tag)" class="ml-4 space-y-0">
                  <div v-for="feed in feedsByTag[tag]" :key="feed.id" class="flex items-center gap-1 relative">
                    <button @click="selectFeed(feed.id, tag)"
                      class="flex-1 min-w-0 text-left px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-2"
                      :class="selectedFeedId === feed.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'">
                      <img v-if="feed.faviconUrl" :src="feed.faviconUrl" alt="" class="w-4 h-4 flex-shrink-0" />
                      <span class="flex-1 min-w-0 truncate">{{ feed.title }}</span>
                      <span v-if="feed.unreadCount > 0"
                        class="flex-shrink-0 text-xs bg-blue-500 dark:bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        {{ feed.unreadCount }}
                      </span>
                    </button>

                    <!-- Dropdown Button -->
                    <div class="relative">
                      <button @click.stop="toggleFeedMenu(feed.id)"
                        class="flex-shrink-0 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        :class="{ 'bg-gray-100 dark:bg-zinc-800': openFeedMenuId === feed.id }">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      <!-- Dropdown Menu -->
                      <Transition name="dropdown">
                        <div v-if="openFeedMenuId === feed.id"
                          class="absolute right-0 mt-1 w-64 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50">
                          <button @click="handleMarkFeedAsRead(feed.id)"
                            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-t-lg transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Mark all as read</span>
                          </button>

                          <!-- Tags Management -->
                          <div class="px-4 py-2 border-t border-gray-200 dark:border-zinc-700">
                            <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Tags</div>

                            <!-- Current Tags -->
                            <div v-if="feed.tags && feed.tags.length > 0" class="flex flex-wrap gap-1 mb-2">
                              <button v-for="feedTag in feed.tags" :key="feedTag"
                                @click="handleRemoveTag(feed.id, feedTag)"
                                class="group flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                                title="Click to remove">
                                <span>#{{ feedTag }}</span>
                                <svg class="w-3 h-3 opacity-50 group-hover:opacity-100" fill="none"
                                  stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div v-else class="text-xs text-gray-500 dark:text-gray-400 mb-2">No tags yet</div>

                            <!-- Add Tag Input -->
                            <input v-model="newTag" @keyup.enter="handleAddTag(feed.id)" @click.stop type="text"
                              placeholder="Add tag (press Enter)"
                              class="w-full px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent" />
                          </div>

                          <button @click="handleDeleteFeed(feed.id, feed.title)"
                            class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete feed</span>
                          </button>
                        </div>
                      </Transition>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Inbox Section (Untagged Feeds) -->
            <div v-if="feedsByTag['__inbox__'] && feedsByTag['__inbox__'].length > 0"
              v-show="!showUnreadOnly || getInboxUnreadCount() > 0"
              class="space-y-0 border-t border-gray-200 dark:border-zinc-800 pt-2 mt-2">
              <div
                class="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded transition-colors group"
                :class="selectedTag === '__inbox__' && selectedFeedId === null ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'">
                <button @click.stop="toggleTagFolderOnly('__inbox__')"
                  class="p-0.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors">
                  <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': openTags.has('__inbox__') }"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button @click="selectTag('__inbox__')" class="flex-1 text-left">
                  📥 Inbox
                </button>
                <span class="text-xs bg-gray-500 dark:bg-zinc-700 text-white px-2 py-0.5 rounded-full">
                  {{ getInboxUnreadCount() }}
                </span>
              </div>

              <!-- Untagged Feeds -->
              <Transition name="expand">
                <div v-if="openTags.has('__inbox__')" class="ml-4 space-y-0">
                  <div v-for="feed in feedsByTag['__inbox__']" :key="feed.id" class="flex items-center gap-1 relative">
                    <button @click="selectFeed(feed.id, '__inbox__')"
                      class="flex-1 min-w-0 text-left px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-2"
                      :class="selectedFeedId === feed.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'">
                      <img v-if="feed.faviconUrl" :src="feed.faviconUrl" alt="" class="w-4 h-4 flex-shrink-0" />
                      <span class="flex-1 min-w-0 truncate">{{ feed.title }}</span>
                      <span v-if="feed.unreadCount > 0"
                        class="flex-shrink-0 text-xs bg-blue-500 dark:bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        {{ feed.unreadCount }}
                      </span>
                    </button>

                    <!-- Dropdown Button -->
                    <div class="relative">
                      <button @click.stop="toggleFeedMenu(feed.id)"
                        class="flex-shrink-0 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        :class="{ 'bg-gray-100 dark:bg-zinc-800': openFeedMenuId === feed.id }">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      <!-- Dropdown Menu (Same as above) -->
                      <Transition name="dropdown">
                        <div v-if="openFeedMenuId === feed.id"
                          class="absolute right-0 mt-1 w-64 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-50">
                          <button @click="handleMarkFeedAsRead(feed.id)"
                            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-t-lg transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Mark all as read</span>
                          </button>

                          <!-- Tags Management -->
                          <div class="px-4 py-2 border-t border-gray-200 dark:border-zinc-700">
                            <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Tags</div>

                            <!-- Current Tags -->
                            <div v-if="feed.tags && feed.tags.length > 0" class="flex flex-wrap gap-1 mb-2">
                              <button v-for="feedTag in feed.tags" :key="feedTag"
                                @click="handleRemoveTag(feed.id, feedTag)"
                                class="group flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                                title="Click to remove">
                                <span>#{{ feedTag }}</span>
                                <svg class="w-3 h-3 opacity-50 group-hover:opacity-100" fill="none"
                                  stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div v-else class="text-xs text-gray-500 dark:text-gray-400 mb-2">No tags yet</div>

                            <!-- Add Tag Input -->
                            <input v-model="newTag" @keyup.enter="handleAddTag(feed.id)" @click.stop type="text"
                              placeholder="Add tag (press Enter)"
                              class="w-full px-2 py-1 text-xs border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent" />
                          </div>

                          <button @click="handleDeleteFeed(feed.id, feed.title)"
                            class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-zinc-700">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete feed</span>
                          </button>
                        </div>
                      </Transition>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>

      </div>

      <!-- Bottom Actions (Fixed at bottom) -->
      <div class="flex-shrink-0 border-t border-gray-200 dark:border-zinc-800 p-2 space-y-2 bg-white dark:bg-zinc-900">
        <button @click="handleSyncAll" :disabled="syncLoading"
          class="w-full text-left px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2">
          <svg class="w-5 h-5" :class="{ 'animate-spin': syncLoading }" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{{ syncLoading ? 'Syncing...' : 'Sync All Feeds' }}</span>
        </button>

        <!-- Sign Out Button - Only show when logged in -->
        <button v-if="session?.user" @click="handleSignOut"
          class="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Sign Out</span>
        </button>

        <!-- Sign In Link - Only show when logged out -->
        <NuxtLink v-else to="/login"
          class="block w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Sign In</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const isOpen = ref(false)
const newFeedUrl = ref('')
const newTag = ref('')
const loading = ref(false)
const discovering = ref(false)
const syncLoading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const discoveredFeeds = ref<Array<{ url: string; title: string; type: string }>>([])
const openFeedMenuId = ref<number | null>(null)
const openTagMenuId = ref<string | null>(null)
const openTags = ref<Set<string>>(new Set())

const { addFeed, syncAll, deleteFeed, updateFeedTags, feeds, selectedFeedId, selectedTag, allTags, feedsByTag } = useFeeds()
const { unreadArticles, showUnreadOnly, markAllAsRead } = useArticles()
const { savedArticleIds } = useSavedArticles()
const { data: session, signOut } = useAuth()

const savedCount = computed(() => savedArticleIds.value.size)

const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

const toggleTagFolderOnly = (tag: string) => {
  if (openTags.value.has(tag)) {
    openTags.value.delete(tag)
  } else {
    openTags.value.add(tag)
  }
}

const selectTag = (tag: string) => {
  selectedTag.value = tag
  selectedFeedId.value = null
  // Open the tag folder when selecting it
  if (!openTags.value.has(tag)) {
    openTags.value.add(tag)
  }
}

const selectFeed = (feedId: number, tag?: string) => {
  selectedFeedId.value = feedId
  selectedTag.value = tag || null
  // Open the tag folder if provided
  if (tag && !openTags.value.has(tag)) {
    openTags.value.add(tag)
  }
}

const getTagUnreadCount = (tag: string) => {
  const tagFeeds = feedsByTag.value[tag] || []
  return tagFeeds.reduce((sum, feed) => sum + feed.unreadCount, 0)
}

const getInboxUnreadCount = () => {
  const inboxFeeds = feedsByTag.value['__inbox__'] || []
  return inboxFeeds.reduce((sum, feed) => sum + feed.unreadCount, 0)
}

const selectSavedArticles = () => {
  selectedFeedId.value = -1
}

const toggleFeedMenu = (feedId: number) => {
  openFeedMenuId.value = openFeedMenuId.value === feedId ? null : feedId
}

const toggleTagMenu = (tag: string) => {
  openTagMenuId.value = openTagMenuId.value === tag ? null : tag
}

const handleMarkFeedAsRead = async (feedId: number) => {
  error.value = null
  success.value = null
  openFeedMenuId.value = null

  try {
    await markAllAsRead(feedId)
    success.value = 'All articles marked as read!'
    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = 'Failed to mark all as read'
  }
}

const handleMarkTagAsRead = async (tag: string) => {
  error.value = null
  success.value = null
  openTagMenuId.value = null

  try {
    // Get all feeds with this tag
    const tagFeeds = feedsByTag.value[tag] || []

    // Mark all articles in all feeds with this tag as read
    for (const feed of tagFeeds) {
      await markAllAsRead(feed.id)
    }

    success.value = `All articles in #${tag} marked as read!`
    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = 'Failed to mark tag as read'
  }
}

const handleDiscoverFeeds = async () => {
  if (!newFeedUrl.value.trim()) return

  discovering.value = true
  error.value = null
  success.value = null
  discoveredFeeds.value = []

  try {
    const response = await $fetch<{ feeds: Array<{ url: string; title: string; type: string }> }>('/api/feeds/discover', {
      method: 'POST',
      body: { url: newFeedUrl.value }
    })

    discoveredFeeds.value = response.feeds
    success.value = `Found ${response.feeds.length} feed(s)! Click one to add it.`

    // Clear success message after 5 seconds
    setTimeout(() => {
      success.value = null
    }, 5000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to discover feeds'
  } finally {
    discovering.value = false
  }
}

const addDiscoveredFeed = async (feedUrl: string) => {
  loading.value = true
  error.value = null
  success.value = null

  try {
    await addFeed(feedUrl)
    success.value = 'Feed added successfully!'
    discoveredFeeds.value = []
    newFeedUrl.value = ''

    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to add feed'
  } finally {
    loading.value = false
  }
}

const handleAddFeed = async () => {
  if (!newFeedUrl.value.trim()) return

  loading.value = true
  error.value = null
  success.value = null

  try {
    await addFeed(newFeedUrl.value)
    success.value = 'Feed added successfully!'
    newFeedUrl.value = ''
    discoveredFeeds.value = []

    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to add feed'
  } finally {
    loading.value = false
  }
}

const handleDiscoverOrAddFeed = async () => {
  // Try to discover feeds first, if that fails, try adding directly
  await handleDiscoverFeeds()
  if (discoveredFeeds.value.length === 0 && !error.value) {
    await handleAddFeed()
  }
}

const handleSyncAll = async () => {
  syncLoading.value = true
  error.value = null

  try {
    const result = await syncAll()
    success.value = `Synced ${result.summary.total} feeds. ${result.summary.newArticles} new articles.`

    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = 'Failed to sync feeds'
  } finally {
    syncLoading.value = false
  }
}

const handleSignOut = async () => {
  await signOut({ callbackUrl: '/login' })
}

const handleDeleteFeed = async (feedId: number, feedTitle: string) => {
  openFeedMenuId.value = null

  if (!confirm(`Are you sure you want to delete "${feedTitle}"?\n\nThis will also delete all articles from this feed.`)) {
    return
  }

  error.value = null
  success.value = null

  try {
    await deleteFeed(feedId)
    success.value = 'Feed deleted successfully!'

    setTimeout(() => {
      success.value = null
    }, 3000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to delete feed'
  }
}

const handleAddTag = async (feedId: number) => {
  const tag = newTag.value.trim().replace(/^#/, '') // Remove leading # if present
  if (!tag) return

  const feed = feeds.value.find(f => f.id === feedId)
  if (!feed) return

  // Check if tag already exists
  if (feed.tags.includes(tag)) {
    error.value = 'Tag already exists'
    setTimeout(() => {
      error.value = null
    }, 2000)
    return
  }

  error.value = null
  success.value = null

  try {
    await updateFeedTags(feedId, [...feed.tags, tag])
    newTag.value = ''
    success.value = 'Tag added!'

    setTimeout(() => {
      success.value = null
    }, 2000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to add tag'
  }
}

const handleRemoveTag = async (feedId: number, tagToRemove: string) => {
  const feed = feeds.value.find(f => f.id === feedId)
  if (!feed) return

  error.value = null
  success.value = null

  try {
    await updateFeedTags(feedId, feed.tags.filter(t => t !== tagToRemove))
    success.value = 'Tag removed!'

    setTimeout(() => {
      success.value = null
    }, 2000)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to remove tag'
  }
}

// Expose isOpen state to parent
defineExpose({
  isOpen
})

// Close menu and dropdowns on Escape key and click outside
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (openFeedMenuId.value !== null) {
        openFeedMenuId.value = null
      } else if (isOpen.value) {
        isOpen.value = false
      }
    }
  }

  const handleClickOutside = (e: MouseEvent) => {
    if (openFeedMenuId.value !== null) {
      openFeedMenuId.value = null
    }
  }

  window.addEventListener('keydown', handleEscape)
  window.addEventListener('click', handleClickOutside)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleEscape)
    window.removeEventListener('click', handleClickOutside)
  })
})
</script>

<style scoped>
/* Smooth show/hide for the discover/add buttons */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 400ms ease, transform 300ms ease, max-height 300ms ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.5);
  max-height: 0;
  /* collapse */
}

.fade-scale-enter-to,
.fade-scale-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 120px;
  /* enough to fit the two-button row */
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Expand transition for tag folders */
.expand-enter-active,
.expand-leave-active {
  transition: all 200ms ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
