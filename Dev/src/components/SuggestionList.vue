<script setup lang="ts">
/**
 * SuggestionList - 模糊搜索建议列表
 * 只负责展示与单项点击，交互编排在 GuessInput 中完成。
 */
defineProps<{
  suggestions: string[]
  selectedIndex: number
}>()

const emit = defineEmits<{
  (e: 'select', name: string): void
}>()
</script>

<template>
  <!-- CSS .suggestions-container 默认 display:none，需内联覆盖为 block（对齐旧版 JS 的 style.display 切换） -->
  <div v-if="suggestions.length" class="suggestions-container" style="display: block">
    <div
      v-for="(s, i) in suggestions"
      :key="s"
      class="suggestion-item"
      :class="{ selected: i === selectedIndex }"
      :data-value="s"
      @mousedown.prevent="emit('select', s)"
    >
      {{ s }}
    </div>
  </div>
</template>
