<script setup lang="ts">
/**
 * GuessInput - 输入区（输入框 + 建议列表 + 确认/随机/兔头/显示答案）
 *
 * 迁移自 play_controller（输入预览防抖、随机选择、确认、显示答案）
 * 与 fuzzy_search_controller（建议列表、键盘选择、点击外部关闭）。
 */
import { ref, onMounted, onUnmounted, computed } from 'vue'
import SuggestionList from './SuggestionList.vue'
import { useGameStore } from '../stores/game'
import { useDataStore } from '../stores/data'
import { useAppStore } from '../stores/app'
import { useQuizStore } from '../stores/quiz'
import { useGameRoute } from '../composables/useGameRoute'
import { useConfirmGuess } from '../composables/useConfirmGuess'
import { useToast } from '../composables/useToast'
import { searchOperators } from '../utils/fuzzySearch'
import { findOperatorByNameOrEnglish } from '../utils/guess'

const gameStore = useGameStore()
const dataStore = useDataStore()
const appStore = useAppStore()
const quiz = useQuizStore()
const route = useGameRoute()
const { confirmByName } = useConfirmGuess()
const toast = useToast()

const isQuestion = computed(() => route.routeType.value === 'question')

const inputRef = ref<HTMLInputElement | null>(null)
const suggestions = ref<string[]>([])
const selectedIndex = ref(-1)
const suggestionsVisible = ref(false)

let previewTimer: ReturnType<typeof setTimeout> | null = null

// ---- 建议列表（迁移 fuzzy_search_controller.onQueryChanged）----
function updateSuggestions(): void {
  const q = inputRef.value?.value.trim() ?? ''
  if (!q || !dataStore.isReady) {
    suggestions.value = []
    selectedIndex.value = -1
    suggestionsVisible.value = false
    return
  }
  const matches = searchOperators(dataStore.operatorsData, q).slice(0, 10)
  suggestions.value = matches
  selectedIndex.value = -1
  suggestionsVisible.value = matches.length > 0
}

function hideSuggestions(): void {
  suggestions.value = []
  selectedIndex.value = -1
  suggestionsVisible.value = false
}

// ---- 输入预览（防抖 300ms 精确匹配，迁移 bindInputPreview）----
function schedulePreview(): void {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    previewTimer = null
    const latest = inputRef.value?.value.trim() ?? ''
    if (!latest) {
      gameStore.setPreview(null)
      return
    }
    const op = findOperatorByNameOrEnglish(dataStore.operatorsData, latest)
    gameStore.setPreview(op ?? null)
  }, 300)
}

function onInput(): void {
  updateSuggestions()
  schedulePreview()
  appStore.setInputName(inputRef.value?.value ?? '')
}

// ---- 建议选中（回填 + 预览）----
function onSelectSuggestion(name: string): void {
  if (!inputRef.value) return
  inputRef.value.value = name
  appStore.setInputName(name)
  gameStore.setPreview(findOperatorByNameOrEnglish(dataStore.operatorsData, name) ?? null)
  hideSuggestions()
}

// ---- 键盘交互（迁移 bindKeyboard，Enter 对齐旧版=预览）----
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    if (!suggestionsVisible.value || suggestions.value.length === 0) return
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % suggestions.value.length
    return
  }
  if (e.key === 'ArrowUp') {
    if (!suggestionsVisible.value || suggestions.value.length === 0) return
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + suggestions.value.length) % suggestions.value.length
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (suggestionsVisible.value && selectedIndex.value >= 0) {
      onSelectSuggestion(suggestions.value[selectedIndex.value])
      return
    }
    // 无选中时：对齐旧版行为，Enter 触发预览而非确认
    const name = inputRef.value?.value.trim() ?? ''
    const op = findOperatorByNameOrEnglish(dataStore.operatorsData, name)
    gameStore.setPreview(op ?? null)
  }
}

// ---- 点击外部关闭建议（迁移 bindOutsideClick）----
function onDocumentClick(e: MouseEvent): void {
  const target = e.target as Node | null
  const wrap = document.querySelector('.input-with-suggestions')
  if (wrap && target && wrap.contains(target)) return
  hideSuggestions()
}

onMounted(() => document.addEventListener('click', onDocumentClick, true))
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true)
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = null
})

// ---- 随机选择（迁移 handleRandomSelect）----
function randomSelect(): void {
  if (!dataStore.operatorsData) return
  const names = Object.keys(dataStore.operatorsData)
  if (names.length === 0) return
  const name = names[Math.floor(Math.random() * names.length)]
  const op = dataStore.operatorsData[name]
  if (inputRef.value) inputRef.value.value = name
  appStore.setInputName(name)
  gameStore.setPreview(op)
}

// ---- 显示答案（迁移 bindShowAnswer）----
function showAnswer(): void {
  const target = gameStore.targetOperator
  if (!target) return
  alert(`正确答案是：${target.name}`)
  gameStore.showAnswer()
}

// ---- 兔头模式（需求 7：出题模式题目不允许时点击仅 Toast 提示，不切换）----
function toggleRabbitMode(): void {
  if (isQuestion.value && quiz.rabbitLocked) {
    toast.show('该题目不允许兔头！')
    return
  }
  appStore.toggleRabbitMode()
}
</script>

<template>
  <div class="input-section">
    <div class="input-section-main">
      <div class="input-with-suggestions">
        <input
          ref="inputRef"
          id="input-name"
          class="input-name"
          placeholder="输入猜测的干员名称"
          autocomplete="off"
          :disabled="gameStore.guessControlsDisabled"
          @input="onInput"
          @keydown="onKeydown"
        >
        <SuggestionList
          :suggestions="suggestionsVisible ? suggestions : []"
          :selected-index="selectedIndex"
          @select="onSelectSuggestion"
        />
      </div>
      <div class="buttons-container">
        <button id="btn-confirm" class="btn-base" :disabled="gameStore.guessControlsDisabled" @click="confirmByName(inputRef?.value ?? '')">确定</button>
        <button id="btn-random-select" class="btn-base" :disabled="gameStore.guessControlsDisabled" @click="randomSelect">随机选择</button>
      </div>
    </div>
    <div class="input-section-extra">
      <button
        type="button"
        id="btn-rabbit-mode"
        class="btn-rabbit-toggle"
        :class="{ 'btn-rabbit-toggle--off': !appStore.rabbitModeEnabled }"
        :aria-pressed="appStore.rabbitModeEnabled ? 'true' : 'false'"
        title="开启时显示生命、攻击、防御、法抗、再部署、费用、阻挡&#10;&quot;让我看看你是什么杯！&quot;"
        @click="toggleRabbitMode"
      >
        兔头模式
      </button>
      <button
        v-if="gameStore.showAnswerVisible"
        type="button"
        id="btn-show-answer"
        class="btn-base btn-show-answer"
        @click="showAnswer"
      >
        显示正确答案
      </button>
    </div>
  </div>
</template>
