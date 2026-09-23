<template>
  <!-- Row (thumb left) in the 1-col phone grid, stacked (thumb on top) ≥sm -->
  <CardFrame class="mini-card flex h-full flex-row p-2 sm:flex-col sm:p-3">
    <!-- With lead image: side thumbnail on phones, hero on top ≥sm -->
    <div v-if="image" class="relative w-28 shrink-0 overflow-hidden sm:w-auto sm:aspect-[4/3]">
      <img
        :src="proxiedImage(image, IMAGE_WIDTH.thumb)!"
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
        style="filter: saturate(.85);"
        loading="lazy"
        decoding="async"
        draggable="false"
        @error="failedImage = image"
      />
    </div>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3" :class="image ? 'pt-3 sm:pt-2.5' : 'pt-3'">
      <!-- Without image: typographic head marker, echoing ArticleCard -->
      <HairlineRule v-if="!image" class="mb-2" />
      <h3
        class="text-sm leading-snug text-ink"
        :class="image ? 'line-clamp-3' : 'line-clamp-4'"
      >{{ article.title }}</h3>
      <div class="mt-auto min-w-0 truncate pt-2">
        <MonoLabel><FeedFavicon :src="article.feedFavicon" class="mr-1" />{{ article.feedTitle }} &middot; {{ relativeDate }}</MonoLabel>
      </div>
    </div>
  </CardFrame>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Article } from '~/types'
import { cardImageUrl } from '~/utils/cardData'
import { formatRelativeDate } from '~/utils/formatDate'
import { IMAGE_WIDTH, proxiedImage } from '~/utils/imageProxy'

const props = defineProps<{ article: Article }>()

const failedImage = ref<string | null>(null)
const image = computed(() => {
  const url = cardImageUrl(props.article.imageUrl)
  return url === failedImage.value ? null : url
})
const relativeDate = computed(() =>
  props.article.publishedAt ? formatRelativeDate(props.article.publishedAt) : ''
)
</script>
