<script setup lang="ts">
/**
 * QuizKeyModal - 粥友出题分享 Key 输入弹窗
 *
 * 流程（需求 2）：输入 Key → 先验证题包是否有效 → 成功则展示题包信息
 * （出题人/题目数/寄语）→ 确认后再进入；失败则提示错误。
 * 底部提供「我要出题」入口（需求 1），跳转出题包编辑后台 SetQuestion。
 */
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useQuizStore } from '../stores/quiz'
import type { QuizPack } from '../services/quizPack'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', key: string): void
}>()

const quiz = useQuizStore()

const keyInput = ref('')
const shown = ref(false)
const phase = ref<'input' | 'verify'>('input')
const validating = ref(false)
const verifyError = ref('')
const verifiedPack = ref<QuizPack | null>(null)
const verifiedKey = ref('')

// 打开时重置
watch(
  () => props.visible,
  async (visible) => {
    document.body.style.overflow = visible ? 'hidden' : ''
    if (visible) {
      keyInput.value = ''
      phase.value = 'input'
      verifyingReset()
      shown.value = false
      await nextTick()
      setTimeout(() => {
        shown.value = true
      }, 10)
    } else {
      shown.value = false
    }
  },
)

function verifyingReset(): void {
  validating.value = false
  verifyError.value = ''
  verifiedPack.value = null
  verifiedKey.value = ''
}

function close(): void {
  emit('close')
}

/** 验证 Key 是否有效（需求 2：先查找确认，不立即切换） */
async function startVerify(): Promise<void> {
  const key = keyInput.value.trim()
  if (!key || validating.value) return
  validating.value = true
  verifyError.value = ''
  try {
    const p = await quiz.lookup(key)
    if (p) {
      verifiedPack.value = p
      verifiedKey.value = key
      phase.value = 'verify'
    } else {
      verifyError.value = quiz.error || '题包不存在或无法加载，请检查 Key。'
    }
  } finally {
    validating.value = false
  }
}

/** 确认进入出题模式 */
function confirmEnter(): void {
  emit('confirm', verifiedKey.value)
}

/** 返回修改 Key */
function backToInput(): void {
  phase.value = 'input'
  verifyError.value = ''
  verifyingReset()
}

/** 我要出题：跳转出题包编辑后台 */
function goToSetQuestion(): void {
  window.location.href = '/SetQuestion'
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.visible) close()
  if (e.key === 'Enter' && phase.value === 'input') startVerify()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div
    v-if="visible"
    class="arkdle-quiz-key-modal"
    :class="{ show: shown }"
    role="dialog"
    aria-modal="true"
    aria-labelledby="arkdle-quiz-key-title"
    @click.self="close"
  >
    <div class="arkdle-quiz-key-modal__panel">
      <div class="arkdle-quiz-key-modal__header">
        <h2 id="arkdle-quiz-key-title" class="arkdle-quiz-key-modal__title">粥友出题</h2>
        <button type="button" class="arkdle-quiz-key-modal__close" aria-label="关闭" @click="close">&times;</button>
      </div>

      <!-- 输入 Key 阶段 -->
      <div v-if="phase === 'input'" class="arkdle-quiz-key-modal__body">
        <p class="arkdle-quiz-key-modal__hint">输入分享 Key 进入出题人制作的题目：</p>
        <input
          v-model="keyInput"
          class="arkdle-quiz-key-modal__input"
          type="text"
          placeholder="请输入分享 Key"
          autocomplete="off"
          spellcheck="false"
          :disabled="validating"
          @keydown.enter="startVerify"
        >
        <p v-if="verifyError" class="arkdle-quiz-key-modal__error">{{ verifyError }}</p>
        <p v-if="validating" class="arkdle-quiz-key-modal__hint">正在验证题包…</p>
      </div>

      <!-- 验证通过 → 题包信息确认阶段 -->
      <div v-else class="arkdle-quiz-key-modal__body">
        <p class="arkdle-quiz-key-modal__hint">已找到题包，确认进入：</p>
        <dl class="arkdle-quiz-key-modal__info">
          <div class="arkdle-quiz-key-modal__info-row">
            <dt>出题人</dt>
            <dd>{{ verifiedPack?.authorNickname || '匿名粥友' }}</dd>
          </div>
          <div class="arkdle-quiz-key-modal__info-row">
            <dt>题目数</dt>
            <dd>{{ verifiedPack?.questions?.length ?? 0 }} 题</dd>
          </div>
          <div v-if="verifiedPack?.authorMessage" class="arkdle-quiz-key-modal__info-row">
            <dt>寄语</dt>
            <dd>{{ verifiedPack.authorMessage }}</dd>
          </div>
        </dl>
      </div>

      <div class="arkdle-quiz-key-modal__actions">
        <!-- 左下角：「我要出题」入口（需求 1，独立于右侧操作，避免错乱） -->
        <button
          v-if="phase === 'input'"
          type="button"
          class="btn-base arkdle-quiz-key-modal__actions-left"
          @click="goToSetQuestion"
        >
          我要出题
        </button>
        <div class="arkdle-quiz-key-modal__actions-right">
          <button type="button" class="btn-base" @click="phase === 'verify' ? backToInput() : close()">
            {{ phase === 'verify' ? '返回修改' : '取消' }}
          </button>
          <button v-if="phase === 'input'" type="button" class="btn-base" :disabled="!keyInput.trim() || validating" @click="startVerify">
            开始
          </button>
          <button v-else type="button" class="btn-base" @click="confirmEnter">确认进入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arkdle-quiz-key-modal {
  position: fixed;
  inset: 0;
  z-index: 10060;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.arkdle-quiz-key-modal.show {
  opacity: 1;
}

.arkdle-quiz-key-modal::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.arkdle-quiz-key-modal__panel {
  position: relative;
  width: min(420px, 90vw);
  background: var(--ark-white-97, #f7f8fa);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  transform: translateY(12px) scale(0.98);
  transition: transform 0.25s ease;
}

.arkdle-quiz-key-modal.show .arkdle-quiz-key-modal__panel {
  transform: translateY(0) scale(1);
}

.arkdle-quiz-key-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.arkdle-quiz-key-modal__title {
  margin: 0;
  font-size: 1.1rem;
}

.arkdle-quiz-key-modal__close {
  border: none;
  background: transparent;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  color: #666;
}

.arkdle-quiz-key-modal__body {
  padding: 18px;
}

.arkdle-quiz-key-modal__hint {
  margin: 0 0 10px;
  font-size: 0.9rem;
  color: #555;
}

.arkdle-quiz-key-modal__input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font-size: 1rem;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  outline: none;
}

.arkdle-quiz-key-modal__input:focus {
  border-color: #4e8cff;
}

.arkdle-quiz-key-modal__error {
  margin: 10px 0 0;
  font-size: 0.85rem;
  color: #dc2626;
}

.arkdle-quiz-key-modal__info {
  margin: 4px 0 0;
}

.arkdle-quiz-key-modal__info-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.08);
}

.arkdle-quiz-key-modal__info-row:last-child {
  border-bottom: none;
}

.arkdle-quiz-key-modal__info-row dt {
  flex: 0 0 64px;
  font-size: 0.9rem;
  color: #888;
}

.arkdle-quiz-key-modal__info-row dd {
  margin: 0;
  font-size: 0.9rem;
  color: #333;
  word-break: break-all;
}

.arkdle-quiz-key-modal__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.arkdle-quiz-key-modal__actions-left {
  flex: none;
}

.arkdle-quiz-key-modal__actions-right {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-left: auto;
}
</style>
