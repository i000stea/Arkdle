<script setup lang="ts">
/**
 * QuizHintBadge - 右上角题包提示悬浮（需求 5）
 * 题包自定义提示到达指定猜测次数后出现。
 */
import { computed } from 'vue'
import { useQuizStore } from '../stores/quiz'
import { useGameRoute } from '../composables/useGameRoute'

const quiz = useQuizStore()
const route = useGameRoute()

// 仅出题模式下显示（切回每日/随机时隐藏）
const visible = computed(() => !!quiz.visibleHint && route.routeType.value === 'question')
</script>

<template>
  <div v-if="visible" class="arkdle-hint-badge" role="note">
    <img class="arkdle-hint-badge__icon" :src="'resource/icon/tips.svg'" alt="" aria-hidden="true">
    <span class="arkdle-hint-badge__text">{{ quiz.visibleHint }}</span>
  </div>
</template>

<style scoped>
.arkdle-hint-badge {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 10040;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid rgba(78, 140, 255, 0.25);
  border-radius: 12px;
  background: rgba(238, 244, 255, 0.92);
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font-size: 0.9rem;
  color: #2b4d8f;
  max-width: min(56vw, 360px);
}

.arkdle-hint-badge__icon {
  flex: none;
  width: 18px;
  height: 18px;
}

.arkdle-hint-badge__text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
