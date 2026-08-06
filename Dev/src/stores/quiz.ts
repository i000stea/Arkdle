/**
 * 粥友出题 Store（迁移自 js/question_mode.js）
 *
 * 职责：题包加载/验证、逐题推进、封面/完成 Overlay、题包自定义提示、
 *      兔头锁定、答题计时与完成信息。
 * 单题目标写入由 startQuestion 完成（复用 game store 的单局流程）。
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { fetchQuizPack } from '../services/quizPack'
import type { QuizPack, QuizQuestion } from '../services/quizPack'
import { findOperatorByNameOrEnglish } from '../utils/guess'
import { useDataStore } from './data'
import { useGameStore } from './game'
import { useAppStore } from './app'
import type { Operator } from '../types/operator'

/** 完成弹窗分享文案的拼接（供复制使用） */
export function buildShareText(pack: QuizPack | null, key: string, elapsedMs: number): string {
  const total = pack?.questions?.length ?? 0
  const author = pack?.authorNickname || '匿名粥友'
  const mm = Math.floor(elapsedMs / 60000)
  const ss = Math.floor((elapsedMs % 60000) / 1000)
  const duration = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return [
    '舟兜 · 粥友出题',
    `出题人：${author}`,
    `题目：${key}`,
    `共 ${total} 题 · 总耗时 ${duration}`,
  ].join('\n')
}

function formatDuration(ms: number): string {
  const mm = Math.floor(ms / 60000)
  const ss = Math.floor((ms % 60000) / 1000)
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export const useQuizStore = defineStore('quiz', () => {
  const pack = ref<QuizPack | null>(null)
  const loadedKey = ref('')
  const questionIndex = ref(0)
  const overlayVisible = ref(false)
  const overlayMode = ref<'intro' | 'completion'>('intro')
  const error = ref<string | null>(null)
  const loading = ref(false)

  // 验证阶段暂存（「先验证，确认后再进入」流程用）
  const pendingPack = ref<QuizPack | null>(null)
  const pendingKey = ref('')

  // 答题计时
  const startTime = ref(0)

  // 完成信息
  const elapsedMs = computed(() => (startTime.value > 0 ? Date.now() - startTime.value : 0))
  const completionShareText = computed(() =>
    buildShareText(pack.value, loadedKey.value, elapsedMs.value),
  )

  // 猜测失败弹窗状态（到达上限且未猜对时触发）
  const failed = ref(false)
  let failedShown = false

  // 题包自定义提示（独立于内置职业/位置提示）
  const customHint = ref('')
  const hintRevealAt = ref(0)
  const hintShown = ref(false)
  const visibleHint = ref('')

  const dataStore = useDataStore()
  const gameStore = useGameStore()
  const appStore = useAppStore()

  const active = computed(() => !!pack.value)
  const currentQuestion = computed<QuizQuestion | null>(() => pack.value?.questions?.[questionIndex.value] ?? null)
  const total = computed(() => pack.value?.questions?.length ?? 0)
  const isLast = computed(() => questionIndex.value >= total.value - 1)

  /** 当前题目是否禁止兔头模式 */
  const rabbitLocked = computed(() => currentQuestion.value?.allowRabbitHead === false)

  /** 当前题目标题（封面文案） */
  const overlayTitle = computed(() => {
    if (overlayMode.value === 'completion') return '完成题目！'
    return '猜猜这位干员是谁？'
  })

  const overlayMessage = computed(() => {
    if (overlayMode.value === 'completion') return `你已完成全部 ${total.value} 道题目，太棒了！`
    return pack.value?.authorMessage || '祝你答题顺利！'
  })

  const overlayStartLabel = computed(() => {
    if (overlayMode.value === 'completion') return '再来一遍'
    return questionIndex.value === 0 ? '开始答题' : `开始第 ${questionIndex.value + 1} 题`
  })

  const overlayProgress = computed(() => {
    if (overlayMode.value === 'completion') return `全部 ${total.value} 题已完成`
    return questionIndex.value > 0 ? `已完成 ${questionIndex.value} / ${total.value} 题` : ''
  })

  // 完成弹窗信息（需求 9）
  const completionInfo = computed(() => ({
    author: pack.value?.authorNickname || '匿名粥友',
    key: loadedKey.value,
    duration: formatDuration(elapsedMs.value),
  }))

  /**
   * 仅验证 Key 是否有效（「先验证再进入」流程第一步）
   * 成功时暂存题包，不切换路由、不显示封面。
   * @returns 验证通过返回题包，否则返回 null
   */
  async function lookup(key: string): Promise<QuizPack | null> {
    loading.value = true
    error.value = null
    try {
      const p = await fetchQuizPack(key)
      if (!p || !Array.isArray(p.questions) || p.questions.length === 0) {
        throw new Error('题包为空或格式无效')
      }
      pendingPack.value = p
      pendingKey.value = key
      return p
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      pendingPack.value = null
      pendingKey.value = ''
      return null
    } finally {
      loading.value = false
    }
  }

  /** 加载题包（复用验证阶段已获取的题包）；返回是否成功 */
  async function load(key: string): Promise<boolean> {
    if (pack.value && loadedKey.value === key) return true

    loading.value = true
    error.value = null
    try {
      let p: QuizPack | null = null
      if (pendingKey.value === key && pendingPack.value) {
        p = pendingPack.value
      } else {
        p = await fetchQuizPack(key)
        if (!p || !Array.isArray(p.questions) || p.questions.length === 0) {
          throw new Error('题包为空或格式无效')
        }
      }
      pack.value = p
      loadedKey.value = key
      pendingPack.value = null
      pendingKey.value = ''
      questionIndex.value = 0
      overlayMode.value = 'intro'
      overlayVisible.value = true
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      pack.value = null
      return false
    } finally {
      loading.value = false
    }
  }

  /** 从题包 hints 抽取首条提示文本 */
  function extractHint(q: QuizQuestion | null): string {
    if (!q) return ''
    if (Array.isArray(q.hints) && q.hints.length > 0) return String(q.hints[0])
    if (typeof q.hints === 'string' && q.hints.trim() !== '') return q.hints.trim()
    return ''
  }

  /**
   * 开始第 idx 题：重置单局 + 写入目标/规则/提示
   * 首次开始（idx===0）时启动答题计时。
   * @returns 目标干员（找不到时返回 null）
   */
  function startQuestion(idx: number): { name: string; data: Operator } | null {
    const q = pack.value?.questions?.[idx]
    if (!q) return null

    questionIndex.value = idx
    overlayVisible.value = false
    failed.value = false
    failedShown = false

    // 首次开始计时
    if (idx === 0 || startTime.value === 0) {
      startTime.value = Date.now()
    }

    const op = findOperatorByNameOrEnglish(dataStore.operatorsData, q.targetText)
    if (!op) return null

    gameStore.startQuestion(op)
    gameStore.setAttemptRules({
      maxAttempts: q.maxGuesses != null ? Number(q.maxGuesses) : 8,
      allowGuessAfterAttemptsExhausted: true,
      allowRevealAnswerAfterAttemptsExhausted: true,
      // 题包模式使用自定义提示（customHint），禁用内置职业/位置提示
      hintRevealAfterAttempt: null,
    })

    // 题包禁止兔头时强制关闭（玩家点击兔头会收到 Toast 提示，见 GuessInput）
    if (q.allowRabbitHead === false) {
      appStore.rabbitModeEnabled = false
    }

    // 题包自定义提示
    customHint.value = extractHint(q)
    hintRevealAt.value = q.hintRevealAfterAttempt != null ? Number(q.hintRevealAfterAttempt) : 0
    hintShown.value = false
    visibleHint.value = ''

    return { name: op.name, data: op }
  }

  /** 封面开始按钮：当前索引开始 */
  function startFromOverlay(): void {
    if (overlayMode.value === 'completion') {
      startQuestion(0)
    } else {
      startQuestion(questionIndex.value)
    }
  }

  /** 进入完成 Overlay */
  function showCompletion(): void {
    overlayMode.value = 'completion'
    overlayVisible.value = true
  }

  /** 推进到下一题（最后一题时进入完成页） */
  function next(): void {
    const nextIndex = questionIndex.value + 1
    if (nextIndex >= total.value) {
      showCompletion()
      return
    }
    startQuestion(nextIndex)
  }

  /** 失败弹窗：重新开始当前题目 */
  function restartCurrent(): { name: string; data: Operator } | null {
    return startQuestion(questionIndex.value)
  }

  /** 失败弹窗：清除失败状态（退出时调用，猜测规则由 startDaily/startRandom 重置） */
  function clearFailed(): void {
    failed.value = false
    failedShown = false
  }

  // 到达上限且未猜对 → 猜测失败弹窗（需求：显示「重新开始 / 退出」）
  watch(
    () => gameStore.attemptsExhausted,
    (exhausted) => {
      if (!active.value || overlayVisible.value) return
      if (exhausted && !gameStore.isVictory && !failedShown) {
        failedShown = true
        failed.value = true
        // 等待玩家选择，期间禁用继续猜测
        gameStore.setAttemptRules({ allowGuessAfterAttemptsExhausted: false })
      }
    },
  )

  // 完成最后一题后延迟自动弹出完成页（需求 8）
  let completionTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    () => gameStore.isVictory,
    (victory) => {
      if (completionTimer) {
        clearTimeout(completionTimer)
        completionTimer = null
      }
      if (victory && active.value && isLast.value) {
        completionTimer = setTimeout(() => {
          completionTimer = null
          showCompletion()
        }, 1500)
      }
    },
  )

  // 题包自定义提示：达到指定猜测次数后显示（迁移 patchProcessGuessForQuestion 的 hint 逻辑）
  watch(
    () => gameStore.attemptsUsed,
    (used) => {
      if (!active.value || hintShown.value) return
      if (hintRevealAt.value > 0 && used >= hintRevealAt.value && customHint.value) {
        hintShown.value = true
        visibleHint.value = customHint.value
      }
    },
  )

  return {
    pack,
    loadedKey,
    questionIndex,
    overlayVisible,
    overlayMode,
    error,
    loading,
    customHint,
    visibleHint,
    active,
    currentQuestion,
    total,
    isLast,
    rabbitLocked,
    failed,
    elapsedMs,
    completionShareText,
    completionInfo,
    overlayTitle,
    overlayMessage,
    overlayStartLabel,
    overlayProgress,
    lookup,
    load,
    startQuestion,
    startFromOverlay,
    showCompletion,
    next,
    restartCurrent,
    clearFailed,
  }
})
