<template>
  <CardFrame class="article-card flex h-full flex-col">
    <header class="shrink-0 px-5 pt-5 sm:px-6">
      <div class="flex items-baseline justify-between gap-3">
        <MonoLabel dash class="min-w-0 truncate"><FeedFavicon :src="article.feedFavicon" class="mr-1" />{{ article.feedTitle }}</MonoLabel>
        <MonoLabel class="shrink-0">{{ relativeDate }}</MonoLabel>
      </div>
      <h2 class="article-card-title mt-3 text-2xl leading-snug text-ink sm:text-3xl">{{ article.title }}</h2>
      <HairlineRule class="mt-4" />
    </header>

    <!-- A printed image sits inside the paper margin; the headline always
         keeps its own ink and contrast, even for bright or broken images. -->
    <div v-if="image" class="article-card-image relative mx-5 mt-4 overflow-hidden sm:mx-6">
      <img
        :src="image"
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
        style="filter: saturate(.85);"
        draggable="false"
        @error="failedImage = image"
      />
    </div>

    <div class="flex min-h-0 flex-1 flex-col px-5 py-4 sm:px-6">
      <p
        class="excerpt-clamp min-h-0 text-base leading-relaxed text-body sm:text-lg"
        :class="image ? 'excerpt-clamp--with-image' : 'excerpt-clamp--full'"
      >{{ excerptText }}</p>
      <div v-if="minutes" class="mt-auto shrink-0 pt-3">
        <MonoLabel>{{ minutes }} min read</MonoLabel>
      </div>
    </div>
  </CardFrame>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Article } from '~/types'
import { cardImageUrl, excerpt, readingTimeMinutes } from '~/utils/cardData'
import { formatRelativeDate } from '~/utils/formatDate'

const props = defineProps<{ article: Article }>()
const failedImage = ref<string | null>(null)
const image = computed(() => {
  const url = cardImageUrl(props.article.imageUrl)
  return url === failedImage.value ? null : url
})
const excerptText = computed(() =>
  excerpt(props.article.content || props.article.summary, 600)
)
const minutes = computed(() => readingTimeMinutes(props.article.content))
const relativeDate = computed(() =>
  props.article.publishedAt ? formatRelativeDate(props.article.publishedAt) : ''
)
</script>

<style scoped>
.article-card-title,
.excerpt-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.article-card-image {
  flex: 0 1 32%;
  min-height: 4rem;
  max-height: 17rem;
}
@media (min-height: 700px) {
  .excerpt-clamp--full { -webkit-line-clamp: 7; }
  .excerpt-clamp--with-image { -webkit-line-clamp: 5; }
}
@media (min-height: 850px) {
  .excerpt-clamp--full { -webkit-line-clamp: 10; }
  .excerpt-clamp--with-image { -webkit-line-clamp: 7; }
}
@media (max-height: 699px) {
  .article-card-title { -webkit-line-clamp: 3; }
  .article-card-image { flex-basis: 25%; }
}
</style>
