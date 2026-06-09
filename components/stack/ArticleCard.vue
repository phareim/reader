<template>
  <CardFrame class="flex h-full flex-col">
    <!-- With lead image: full bleed, headline overlaid -->
    <div v-if="image" class="relative shrink-0" style="height: 52%;">
      <img
        :src="image"
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
        style="filter: saturate(.85);"
        draggable="false"
      />
      <div
        class="absolute inset-0"
        style="background: linear-gradient(to top, rgba(20,16,10,.78) 0%, rgba(20,16,10,.25) 55%, rgba(20,16,10,.05) 100%);"
      />
      <div class="absolute inset-x-0 bottom-0 px-5 pb-4">
        <div class="font-mono uppercase" style="font-size: 10px; letter-spacing: 0.16em; color: rgba(255,250,240,.85);">
          &mdash; {{ article.feedTitle }} &middot; {{ relativeDate }}
        </div>
        <h2 class="mt-1.5 text-2xl leading-snug" style="color: #fffdf6; text-shadow: 0 1px 2px rgba(0,0,0,.35);">
          {{ article.title }}
        </h2>
      </div>
    </div>

    <!-- Without image: typographic head -->
    <div v-else class="px-5 pt-5">
      <div class="flex items-baseline justify-between">
        <MonoLabel dash>{{ article.feedTitle }}</MonoLabel>
        <MonoLabel>{{ relativeDate }}</MonoLabel>
      </div>
      <h2 class="mt-3 text-2xl leading-snug text-ink">{{ article.title }}</h2>
      <HairlineRule class="mt-4" />
    </div>

    <!-- Shared body -->
    <div class="flex min-h-0 flex-1 flex-col px-5 py-4">
      <p class="excerpt-clamp text-base leading-relaxed text-body">{{ excerptText }}</p>
      <div class="mt-auto pt-3">
        <MonoLabel v-if="minutes">{{ minutes }} min read</MonoLabel>
      </div>
    </div>
  </CardFrame>
</template>

<script setup lang="ts">
import type { Article } from '~/types'
import { cardImageUrl, excerpt, readingTimeMinutes } from '~/utils/cardData'
import { formatRelativeDate } from '~/utils/formatDate'

const props = defineProps<{ article: Article }>()

const image = computed(() => cardImageUrl(props.article.imageUrl))
const excerptText = computed(() =>
  excerpt(props.article.content || props.article.summary, 280)
)
const minutes = computed(() => readingTimeMinutes(props.article.content))
const relativeDate = computed(() =>
  props.article.publishedAt ? formatRelativeDate(props.article.publishedAt) : ''
)
</script>

<style scoped>
.excerpt-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
