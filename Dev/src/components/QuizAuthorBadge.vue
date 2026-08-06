<script setup lang="ts">
/**
 * QuizAuthorBadge - 左上角出题人悬浮徽章（需求 4）
 * 点击切换「仅图标 / 图标+信息」两种展示模式。
 */
import { ref, computed } from 'vue'
import { useQuizStore } from '../stores/quiz'
import { useGameRoute } from '../composables/useGameRoute'

const quiz = useQuizStore()
const route = useGameRoute()
const compact = ref(false)

const author = computed(() => quiz.pack?.authorNickname || '匿名粥友')

// 仅出题模式下显示（切回每日/随机时隐藏）
const visible = computed(() => quiz.active && route.routeType.value === 'question')
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="arkdle-author-badge"
    :class="{ 'arkdle-author-badge--compact': compact }"
    :title="compact ? '展开出题人信息' : '收起为仅图标'"
    @click="compact = !compact"
  >
    <img class="arkdle-author-badge__icon" :src="'resource/icon/fireworks.svg'" alt="" aria-hidden="true">
    <span v-if="!compact" class="arkdle-author-badge__name">出题人：{{ author }}</span>
  </button>
</template>

<style scoped>
.arkdle-author-badge {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 10040;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  font-size: 0.88rem;
  color: #333;
  max-width: min(48vw, 320px);
}

.arkdle-author-badge__icon {
  flex: none;
  width: 18px;
  height: 18px;
}

.arkdle-author-badge__name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.arkdle-author-badge--compact {
  padding: 8px 10px;
}
</style>
