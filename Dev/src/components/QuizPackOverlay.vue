<script setup lang="ts">
/**
 * QuizPackOverlay - 粥友出题封面 / 完成 Overlay
 * 完成页信息（需求 9）：出题人 / 题目id / 总耗时 / 分享（复制）。
 */
import { ref } from 'vue'
import { useQuizStore } from '../stores/quiz'

const quiz = useQuizStore()
const copyTip = ref('')

function onStart(): void {
  copyTip.value = ''
  quiz.startFromOverlay()
}

/** 复制完成分享文案 */
async function copyShare(): Promise<void> {
  try {
    await navigator.clipboard.writeText(quiz.completionShareText)
    copyTip.value = '已复制到剪贴板'
  } catch {
    copyTip.value = '复制失败，请手动复制'
  }
}
</script>

<template>
  <div
    v-if="quiz.overlayVisible || quiz.error"
    id="arkdle-question-overlay"
    class="arkdle-question-overlay"
  >
    <div class="arkdle-question-overlay__backdrop"></div>
    <div class="arkdle-question-overlay__panel">
      <!-- 加载失败态 -->
      <template v-if="quiz.error">
        <p class="arkdle-overlay-error">
          <img class="arkdle-overlay-inline-icon" :src="'resource/icon/error.svg'" alt="" aria-hidden="true"> 加载失败
        </p>
        <p style="font-size: 0.85rem; color: #666; margin: 8px 0;">{{ quiz.error }}</p>
      </template>

      <!-- 封面（开始答题） -->
      <template v-else-if="quiz.overlayMode === 'intro'">
        <div class="arkdle-question-overlay__avatar"><img :src="'resource/icon/fireworks.svg'" alt="" aria-hidden="true"></div>
        <div class="arkdle-question-overlay__badge">粥友出题</div>
        <p class="arkdle-question-overlay__nickname" id="aqo-nickname">{{ quiz.pack?.authorNickname || '匿名粥友' }}</p>
        <p class="arkdle-question-overlay__message" id="aqo-message">{{ quiz.overlayMessage }}</p>
        <hr class="arkdle-question-overlay__divider">
        <p class="arkdle-question-overlay__topic-label">
          第 <span id="aqo-q-index">{{ quiz.questionIndex + 1 }}</span> 题 / 共
          <span id="aqo-q-total">{{ quiz.total }}</span> 题
        </p>
        <p class="arkdle-question-overlay__topic" id="aqo-q-title">{{ quiz.overlayTitle }}</p>
        <button type="button" class="arkdle-question-overlay__btn" id="aqo-start-btn" @click="onStart">
          {{ quiz.overlayStartLabel }}
        </button>
        <p class="arkdle-question-overlay__progress" id="aqo-progress-hint">{{ quiz.overlayProgress }}</p>
      </template>

      <!-- 完成页（需求 9：出题人 / 题目id / 总耗时 / 分享复制） -->
      <template v-else>
        <div class="arkdle-question-overlay__avatar"><img :src="'resource/icon/fireworks.svg'" alt="" aria-hidden="true"></div>
        <div class="arkdle-question-overlay__badge">粥友出题</div>
        <p class="arkdle-question-overlay__nickname" id="aqo-nickname">{{ quiz.completionInfo.author }}</p>
        <p class="arkdle-question-overlay__message">你已完成全部 {{ quiz.total }} 道题目，太棒了！</p>
        <hr class="arkdle-question-overlay__divider">
        <dl class="arkdle-completion-info">
          <div class="arkdle-completion-info__row">
            <dt>出题人</dt>
            <dd>{{ quiz.completionInfo.author }}</dd>
          </div>
          <div class="arkdle-completion-info__row">
            <dt>题目id</dt>
            <dd>{{ quiz.completionInfo.key }}</dd>
          </div>
          <div class="arkdle-completion-info__row">
            <dt>总耗时</dt>
            <dd>{{ quiz.completionInfo.duration }}</dd>
          </div>
        </dl>
        <button type="button" class="arkdle-question-overlay__btn" id="aqo-share-btn" @click="copyShare">分享（复制）</button>
        <p v-if="copyTip" class="arkdle-question-overlay__progress" aria-live="polite">{{ copyTip }}</p>
        <p class="arkdle-question-overlay__progress">已完成全部 {{ quiz.total }} 题</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.arkdle-overlay-error {
  color: #dc2626;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.arkdle-overlay-inline-icon {
  width: 1.2em;
  height: 1.2em;
  flex: none;
}

.arkdle-question-overlay__avatar img {
  width: 30px;
  height: 30px;
}

.arkdle-completion-info {
  margin: 4px 0 16px;
  text-align: left;
}

.arkdle-completion-info__row {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.08);
}

.arkdle-completion-info__row:last-child {
  border-bottom: none;
}

.arkdle-completion-info__row dt {
  flex: 0 0 56px;
  font-size: 0.85rem;
  color: #888;
}

.arkdle-completion-info__row dd {
  margin: 0;
  font-size: 0.88rem;
  color: #333;
  word-break: break-all;
}
</style>
