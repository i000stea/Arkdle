<script setup lang="ts">
/**
 * GuessFailedModal - 猜测失败弹窗（出题模式到达上限且未猜对时）
 * 按钮：重新开始（重开当前题）/ 退出（回到默认每日模式）。
 */
import { useQuizStore } from '../stores/quiz'
import { useGameRoute } from '../composables/useGameRoute'

const quiz = useQuizStore()
const route = useGameRoute()

function restart(): void {
  quiz.restartCurrent()
}

function exitQuiz(): void {
  quiz.clearFailed()
  route.switchToDaily()
}
</script>

<template>
  <div
    v-if="quiz.failed"
    class="arkdle-failed-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="arkdle-failed-title"
  >
    <div class="arkdle-failed-modal__panel">
      <p id="arkdle-failed-title" class="arkdle-failed-modal__title">
        <img class="arkdle-failed-modal__icon" :src="'resource/icon/cry.svg'" alt="" aria-hidden="true">
        猜测失败
      </p>
      <p class="arkdle-failed-modal__message">已达本题最大猜测次数，未能猜出干员。</p>
      <div class="arkdle-failed-modal__actions">
        <button type="button" class="btn-base" @click="restart">重新开始</button>
        <button type="button" class="btn-base" @click="exitQuiz">退出</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arkdle-failed-modal {
  position: fixed;
  inset: 0;
  z-index: 10065;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arkdle-failed-modal::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.arkdle-failed-modal__panel {
  position: relative;
  width: min(340px, 90vw);
  background: var(--ark-white-97, #f7f8fa);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  padding: 26px 24px 20px;
  text-align: center;
}

.arkdle-failed-modal__title {
  margin: 0 0 12px;
  font-size: 1.25rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.arkdle-failed-modal__icon {
  width: 26px;
  height: 26px;
}

.arkdle-failed-modal__message {
  margin: 0 0 22px;
  font-size: 0.92rem;
  color: #555;
  line-height: 1.5;
}

.arkdle-failed-modal__actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
