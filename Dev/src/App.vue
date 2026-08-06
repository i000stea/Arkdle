<script setup lang="ts">
import { onMounted, computed, watch, ref } from 'vue'
import GuessInput from './components/GuessInput.vue'
import GuessBoard from './components/GuessBoard.vue'
import Tooltip from './components/Tooltip.vue'
import TutorialModal from './components/TutorialModal.vue'
import QuizPackOverlay from './components/QuizPackOverlay.vue'
import ScreenshotShareModal from './components/ScreenshotShareModal.vue'
import ChangelogModal from './components/ChangelogModal.vue'
import QuizKeyModal from './components/QuizKeyModal.vue'
import Toast from './components/Toast.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import QuizAuthorBadge from './components/QuizAuthorBadge.vue'
import QuizHintBadge from './components/QuizHintBadge.vue'
import GuessFailedModal from './components/GuessFailedModal.vue'
import { useDataLoader } from './composables/useDataLoader'
import { useDataStore } from './stores/data'
import { useGameStore } from './stores/game'
import { useAppStore } from './stores/app'
import { useTutorialStore } from './stores/tutorial'
import { useQuizStore } from './stores/quiz'
import { useGameRoute } from './composables/useGameRoute'
import { useConfirmGuess } from './composables/useConfirmGuess'
import { useContentDrag } from './composables/useContentDrag'
import { useScreenshotShare } from './composables/useScreenshotShare'
import { useConfirm } from './composables/useConfirm'
import { findOperatorByNameOrEnglish } from './utils/guess'

const dataStore = useDataStore()
const gameStore = useGameStore()
const appStore = useAppStore()
const tutorial = useTutorialStore()
const quiz = useQuizStore()
const route = useGameRoute()
const { confirmByName } = useConfirmGuess()
const share = useScreenshotShare()
const confirm = useConfirm()
const changelogRef = ref<InstanceType<typeof ChangelogModal> | null>(null)

// 兔头模式 → body class（全局 CSS 依赖 body.rabbit-mode-off）
watch(
  () => appStore.rabbitModeEnabled,
  (enabled) => {
    document.body.classList.toggle('rabbit-mode-off', !enabled)
  },
  { immediate: true },
)

// 出题模式 → body class（对标 applyQuestionTheme 的 topic-mode-question）
const isQuestion = computed(() => route.routeType.value === 'question')
watch(isQuestion, (q) => {
  document.body.classList.toggle('topic-mode-question', q)
}, { immediate: true })

// 随机模式 → 主题色过渡（迁移 route_controller.syncRandomTopicVisualTheme）
function applyRouteTheme(isRandom: boolean): void {
  const target = isRandom ? 1 : 0
  const startT = parseFloat(document.documentElement.style.getPropertyValue('--ark-theme-t') || '0') || 0
  if (Math.abs(startT - target) < 1e-5) {
    document.documentElement.style.setProperty('--ark-theme-t', String(target))
    return
  }
  const t0 = performance.now()
  const TWEEN_MS = 480
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
  const tick = (now: number): void => {
    const u = Math.min(1, (now - t0) / TWEEN_MS)
    const k = easeOutCubic(u)
    const v = startT + (target - startT) * k
    document.documentElement.style.setProperty('--ark-theme-t', v.toFixed(5))
    if (u < 1) {
      requestAnimationFrame(tick)
    } else {
      document.documentElement.style.setProperty('--ark-theme-t', String(target))
    }
  }
  requestAnimationFrame(tick)
}

watch(
  () => route.routeType.value,
  (type) => {
    const isRandom = type === 'random'
    document.body.classList.toggle('topic-mode-random', isRandom)
    applyRouteTheme(isRandom)
  },
  { immediate: true },
)

// 当前模式文案（对标旧版 applyRouteVisualOverrides 的 topic-source 切换）
const modeLabel = computed(() => {
  switch (route.routeType.value) {
    case 'random':
      return '本地随机题目'
    case 'question':
      return '粥友出题'
    default:
      return '每日题目'
  }
})

const topicText = computed(() => {
  if (dataStore.isLoading || !dataStore.isReady) return '正在获取题目...'
  if (isQuestion.value) {
    if (quiz.error) return `粥友出题加载失败：${quiz.error}`
    if (quiz.active) return `粥友出题 · 第 ${quiz.questionIndex + 1} / ${quiz.total} 题 · 限 ${gameStore.maxAttempts} 次`
  }
  return modeLabel.value
})

// 出题加载失败时红色加粗（对标 showLoadError）
const topicErrorStyle = computed(() =>
  isQuestion.value && quiz.error ? { color: 'red', fontWeight: 'bold' as const } : {},
)

// 出题模式显示题包自定义提示，其余模式显示内置提示
// （需求 5：题包提示改为右上角悬浮 QuizHintBadge，此处仅保留非出题模式的内置提示）
const hintBarText = computed(() => (isQuestion.value ? '' : gameStore.hintText))

// 随机模式下显示「本日题目」切换按钮
const isRandom = computed(() => route.routeType.value === 'random')
const isDaily = computed(() => route.routeType.value === 'daily')

// 出题模式：出题人信息（需求 4：左上角悬浮徽章之外，footer 保留）
const editInfoText = computed(() =>
  isQuestion.value && quiz.active ? `出题人：${quiz.pack?.authorNickname || '匿名粥友'}` : '',
)

// 出题模式：猜对且未到最后一题时显示「进入下一题」（需求 8：最后一题自动弹完成页，不再显示按钮）
const quizNextVisible = computed(
  () => isQuestion.value && quiz.active && gameStore.isVictory && !quiz.overlayVisible && !quiz.isLast,
)

// 截图分享：仅每日模式且在次数内通关后显示（v1.3.3 规则：超次数通关不提供）
const screenshotVisible = computed(
  () => route.routeType.value === 'daily' && gameStore.isVictory && gameStore.attemptsUsed <= gameStore.maxAttempts,
)

/** 出题模式下点击每日/随机：确认后退出当前粥友出题（需求 3） */
function askExitQuiz(mode: 'daily' | 'random'): void {
  confirm.ask('退出当前粥友出题？', () => {
    if (mode === 'daily') route.switchToDaily()
    else route.switchToRandom()
  })
}

/** 粥友出题入口：打开内部 Key 输入弹窗（替代 window.prompt） */
const quizKeyModalVisible = ref(false)

function enterQuizMode(): void {
  quizKeyModalVisible.value = true
}

function onQuizKeyConfirm(key: string): void {
  quizKeyModalVisible.value = false
  route.switchToQuestion(key)
}

/** 每日进度回放：逐条确认（渲染由 GuessBoard watch 驱动，与原版同步回放一致） */
function replayDaily(names: string[]): void {
  for (const name of names) {
    if (gameStore.gameOver) break
    const op = findOperatorByNameOrEnglish(dataStore.operatorsData, name)
    if (!op) continue
    confirmByName(name)
  }
}

onMounted(async () => {
  // 1. 加载数据（版本校验 + 缓存），失败降级本地缓存
  const { loadData, loadFromCacheOnly } = useDataLoader()
  await loadData()
  if (!dataStore.isReady) {
    console.warn('[App] 云端加载失败，降级使用本地缓存')
    loadFromCacheOnly()
  }
  console.log('[App] 数据加载完成，共', Object.keys(dataStore.operatorsData ?? {}).length, '个干员')

  // 2. 启动路由（每日/随机/出题），每日模式返回待回放名单
  const replay = await route.start()
  if (replay && replay.length) {
    console.log('[App] 回放每日历史进度，共', replay.length, '条')
    replayDaily(replay)
  }

  // 3. 触摸拖拽滚动（迁移 content_drag）
  useContentDrag()

  // 4. 教程自动显示（首次访问或 30 天未打开）
  if (tutorial.shouldAutoShow()) {
    setTimeout(() => {
      tutorial.open()
      tutorial.markShown()
    }, 1500)
  }
})
</script>

<template>
  <header>
    <p class="title head-font">舟兜</p>
    <p class="sub-label head-font">Arkdle</p>
    <div class="top-tool" aria-label="工具栏">
      <div class="tool-item" id="tool-tutorial" role="button" aria-label="打开教程" @click="tutorial.open()"></div>
      <div class="tool-item"></div>
      <div class="tool-item tool-titlePlaceholder"></div>
      <div class="tool-item"></div>
      <div class="tool-item"></div>
    </div>
  </header>

  <div class="container">
    <div class="sub-label">明日方舟主题Wordle</div>
    <div class="sub-label sub-info" id="topic-source" :style="topicErrorStyle">{{ topicText }}</div>

    <!-- 提示条：题包模式显示自定义提示，其余模式显示内置提示 -->
    <div
      v-if="hintBarText"
      id="arkdle-hint-bar"
      class="arkdle-question-hint-bar visible"
      aria-live="polite"
    >
      {{ hintBarText }}
    </div>

    <GuessInput />

    <div class="scroll-container">
      <GuessBoard />
    </div>
  </div>

  <footer>
    <div id="attempts">已猜次数: <span>{{ gameStore.attemptsUsed }} / {{ gameStore.maxAttempts }}</span></div>
    <button
      v-if="screenshotVisible"
      type="button"
      id="btn-daily-screenshot-share"
      class="btn-base btn-screenshot-share"
      @click="share.open()"
    >
      截图分享
    </button>
    <div class="footer-mode-buttons">
      <!-- 每日题目：随机模式直接切换；出题模式需确认退出（需求 3） -->
      <button v-if="isRandom" id="btn-daily-topic" class="btn-base" @click="route.switchToDaily()">本日题目</button>
      <button v-if="isQuestion" id="btn-daily-topic" class="btn-base" @click="askExitQuiz('daily')">每日题目</button>
      <!-- 随机出题：每日模式直接切换；出题模式需确认退出（需求 3） -->
      <button v-if="isDaily" id="btn-random-topic" class="btn-base" @click="route.switchToRandom()">随机出题</button>
      <button v-if="isQuestion" id="btn-random-topic" class="btn-base" @click="askExitQuiz('random')">随机出题</button>
      <!-- 进入下一题（需求 6：动态效果样式见 CSS） -->
      <button v-if="quizNextVisible" id="btn-quiz-next" class="btn-base btn-question-mode-next" @click="quiz.next()">进入下一题</button>
      <!-- 粥友出题入口：非出题模式 -->
      <button v-if="!isQuestion" id="btn-quiz-entry" class="btn-base" @click="enterQuizMode">粥友出题</button>
    </div>
    <p class="copyright" id="copyright-line">基于明日方舟IP的非官方粉丝游戏 <span id="app-version-display" aria-live="polite">{{ dataStore.appVersion ?? '…' }}</span></p>
    <p class="copyright" id="editinfo">{{ editInfoText }}</p>
    <p class="creator-credit" aria-label="创作署名：千杯茶、礼崩弦坏"><span class="creator-label">联合创作</span><span class="creator-sep" aria-hidden="true"> · </span><span class="creator-name">千杯茶</span><span class="creator-sep" aria-hidden="true"> · </span><span class="creator-name">礼崩弦坏</span></p>
  </footer>
  <button type="button" id="btn-changelog" class="arkdle-changelog-trigger" aria-expanded="false" aria-controls="arkdle-changelog-modal" @click="changelogRef?.open()">更新日志</button>

  <!-- 全局浮窗与弹窗 -->
  <Tooltip />
  <TutorialModal />
  <QuizPackOverlay />
  <ScreenshotShareModal />
  <ChangelogModal ref="changelogRef" />
  <QuizKeyModal :visible="quizKeyModalVisible" @close="quizKeyModalVisible = false" @confirm="onQuizKeyConfirm" />
  <Toast />
  <ConfirmModal />
  <GuessFailedModal />
  <QuizAuthorBadge />
  <QuizHintBadge />
</template>
