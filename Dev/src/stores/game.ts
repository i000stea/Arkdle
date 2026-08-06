/**
 * 游戏单局状态 Store（对标旧版 play_model + play_controller 的状态与判定逻辑）
 *
 * 职责：
 * - 单局目标 / 猜测历史 / 终局状态
 * - 尝试规则（次数上限、耗尽后行为、提示时机）
 * - 确认猜测的核心判定（迁移 handleConfirmClick 的纯逻辑部分）
 * - 每日进度持久化（watch 自动触发，替代旧版 _suppressDailyPersist 手动抑制）
 *
 * 视图副作用（胜利特效、禁用控件、提示条显示）由组件 watch 本 store 触发，不放在这里。
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Operator, GuessRow } from '../types/operator'
import { readStorage, writeStorage } from '../utils/storage'
import { getTodayStr } from '../utils/date'

const DAILY_GUESS_CACHE_KEY = 'arkdle_refactor_daily_guess_cache'

interface DailyProgressPayload {
  v: number
  mode: 'Daily'
  date: string
  targetName: string
  guessNames: string[]
  gameOver: boolean
  isVictory: boolean
  attemptsExhausted: boolean
  hintShown: boolean
}

export interface AttemptRules {
  maxAttempts: number
  allowGuessAfterAttemptsExhausted: boolean
  allowRevealAnswerAfterAttemptsExhausted: boolean
  hintRevealAfterAttempt: number | null
}

/** confirm() 的结算结果，供视图层消费 */
export interface ConfirmResult {
  row: GuessRow
  isVictory: boolean
  shouldEndGame: boolean
  attemptsExhausted: boolean
  shouldShowAnswer: boolean
  exhaustedNow: boolean
  hintText: string
}

/** 构建提示文本（纯函数：只抽取不暴露答案的信息） */
function buildHintText(target: Operator): string {
  const p = target.profession ? `职业：${target.profession}` : ''
  const pos = target.position ? `位置：${target.position}` : ''
  const parts = [p, pos].filter(Boolean)
  if (parts.length === 0) return ''
  return `提示：${parts.join('，')}`
}

export const useGameStore = defineStore('game', () => {
  // ---- 目标 ----
  const targetOperator = ref<Operator | null>(null)
  const targetOperatorName = ref('')

  // ---- 猜测历史与终局 ----
  const guessHistory = ref<GuessRow[]>([])
  const gameOver = ref(false)
  const isVictory = ref(false)
  const attemptsExhausted = ref(false)
  const hintShown = ref(false)

  // ---- 预览行（输入命中时显示的未确认行）----
  const previewOperator = ref<Operator | null>(null)

  // ---- 提示条（到达指定次数后自动揭示，仅一次）----
  const hintText = ref('')

  // ---- 尝试规则 ----
  const maxAttempts = ref(8)
  const allowGuessAfterAttemptsExhausted = ref(true)
  const allowRevealAnswerAfterAttemptsExhausted = ref(true)
  const hintRevealAfterAttempt = ref<number | null>(null)

  // ---- 派生状态 ----
  const attemptsUsed = computed(() => guessHistory.value.length)
  const limited = computed(() => typeof maxAttempts.value === 'number' && Number.isFinite(maxAttempts.value) && maxAttempts.value > 0)

  /** 是否展示「显示正确答案」入口（次数耗尽 + 配置允许 + 未胜利） */
  const showAnswerVisible = computed(
    () => attemptsExhausted.value && allowRevealAnswerAfterAttemptsExhausted.value && !isVictory.value,
  )

  /** 猜测控件是否禁用（游戏已结束，或耗尽且不允许继续） */
  const guessControlsDisabled = computed(
    () => gameOver.value || (attemptsExhausted.value && !allowGuessAfterAttemptsExhausted.value),
  )

  // ---- 每日模式标志：开启后 watch 自动持久化进度 ----
  const dailyMode = ref(false)

  /** 重置/初始化一局（新局一定是干净的） */
  function setTarget(operator: Operator): void {
    targetOperator.value = operator
    targetOperatorName.value = operator.name
    guessHistory.value = []
    gameOver.value = false
    isVictory.value = false
    attemptsExhausted.value = false
    hintShown.value = false
    previewOperator.value = null
    hintText.value = ''
  }

  /** 设置/清除预览行 */
  function setPreview(operator: Operator | null): void {
    previewOperator.value = operator
  }

  /** 写入尝试规则（只接受合法值，非法输入保持原配置） */
  function setAttemptRules(rules: Partial<AttemptRules>): void {
    if (typeof rules.maxAttempts === 'number' && Number.isFinite(rules.maxAttempts) && rules.maxAttempts > 0) {
      maxAttempts.value = Math.floor(rules.maxAttempts)
    }
    if (rules.allowGuessAfterAttemptsExhausted != null) {
      allowGuessAfterAttemptsExhausted.value = !!rules.allowGuessAfterAttemptsExhausted
    }
    if (rules.allowRevealAnswerAfterAttemptsExhausted != null) {
      allowRevealAnswerAfterAttemptsExhausted.value = !!rules.allowRevealAnswerAfterAttemptsExhausted
    }
    if (rules.hintRevealAfterAttempt != null) {
      hintRevealAfterAttempt.value = Math.max(1, Math.floor(Number(rules.hintRevealAfterAttempt)))
    }
  }

  /** 重置为默认尝试规则（每日/随机模式用，避免跨模式泄漏上一局的限制） */
  function resetDefaultRules(): void {
    maxAttempts.value = 8
    allowGuessAfterAttemptsExhausted.value = true
    allowRevealAnswerAfterAttemptsExhausted.value = true
    hintRevealAfterAttempt.value = null
  }

  /**
   * 确认一次猜测（迁移 handleConfirmClick 的判定逻辑）
   * @returns 结算结果；游戏已结束或目标未设置时返回 null（调用方直接忽略）
   */
  function confirm(guessOp: Operator): ConfirmResult | null {
    if (gameOver.value) return null
    const targetOp = targetOperator.value
    if (!targetOp) return null

    const nextHistory = [...guessHistory.value, { name: guessOp.name, data: guessOp }]
    const win = guessOp.name === targetOp.name
    const used = nextHistory.length

    let exhausted = attemptsExhausted.value
    let shouldShowAnswer = false
    let shouldEndGame = win
    let hint = ''

    // 非胜利且开启次数限制：检查是否达到上限
    if (!win && limited.value) {
      const nowExhausted = used >= maxAttempts.value
      if (nowExhausted) {
        exhausted = true
        shouldShowAnswer = allowRevealAnswerAfterAttemptsExhausted.value
        if (!allowGuessAfterAttemptsExhausted.value) {
          shouldEndGame = true
        }
      }
    }

    // 提示系统：到达指定尝试次数后揭示提示（仅一次）
    const hintAt = hintRevealAfterAttempt.value
    if (!win && !hintShown.value && hintAt != null && Number.isFinite(hintAt) && used >= hintAt) {
      const text = buildHintText(targetOp)
      if (text) {
        hintText.value = text
        hintShown.value = true
      }
    }

    guessHistory.value = nextHistory
    gameOver.value = shouldEndGame
    isVictory.value = win
    attemptsExhausted.value = exhausted

    return {
      row: { name: guessOp.name, data: guessOp },
      isVictory: win,
      shouldEndGame,
      attemptsExhausted: exhausted,
      shouldShowAnswer,
      exhaustedNow: used >= maxAttempts.value,
      hintText: hint,
    }
  }

  /** 查看答案：结束游戏 */
  function showAnswer(): void {
    gameOver.value = true
  }

  // ---- 每日进度持久化 ----

  function saveDailyProgress(): void {
    const targetName = targetOperatorName.value.trim()
    if (!targetName) return

    const guessNames = guessHistory.value
      .map((row) => (row.data?.name || row.name || '').trim())
      .filter(Boolean)

    const payload: DailyProgressPayload = {
      v: 1,
      mode: 'Daily',
      date: getTodayStr(),
      targetName,
      guessNames,
      gameOver: gameOver.value,
      isVictory: isVictory.value,
      attemptsExhausted: attemptsExhausted.value,
      hintShown: hintShown.value,
    }
    writeStorage(DAILY_GUESS_CACHE_KEY, payload)
  }

  /** 加载每日猜测进度（校验日期/模式/目标一致），返回历史干员名列表 */
  function loadDailyProgress(targetName: string): string[] {
    const expected = String(targetName || '').trim()
    if (!expected) return []

    const obj = readStorage<DailyProgressPayload>(DAILY_GUESS_CACHE_KEY)
    if (!obj || typeof obj !== 'object') return []
    if (obj.date !== getTodayStr()) return []
    if (obj.mode !== 'Daily') return []
    if (String(obj.targetName || '').trim() !== expected) return []

    const names = Array.isArray(obj.guessNames) ? obj.guessNames : []
    return names.map((n) => String(n || '').trim()).filter(Boolean)
  }

  /** 每日局启动：设目标 + 恢复进度 + 开启自动持久化 */
  function startDaily(operator: Operator): string[] {
    setTarget(operator)
    resetDefaultRules()
    const replayNames = loadDailyProgress(operator.name)
    dailyMode.value = true
    return replayNames
  }

  /** 随机局启动：设目标 + 关闭每日持久化 */
  function startRandom(operator: Operator): void {
    setTarget(operator)
    resetDefaultRules()
    dailyMode.value = false
  }

  /** 出题局启动：设目标 + 关闭每日持久化 */
  function startQuestion(operator: Operator): void {
    setTarget(operator)
    dailyMode.value = false
  }

  // 每日模式下，局内状态变化自动持久化（回放期间 dailyMode 尚未开启，不会覆盖旧存档）
  watch(
    [guessHistory, gameOver, isVictory, attemptsExhausted, hintShown],
    () => {
      if (dailyMode.value) saveDailyProgress()
    },
    { deep: true },
  )

  return {
    targetOperator,
    targetOperatorName,
    guessHistory,
    gameOver,
    isVictory,
    attemptsExhausted,
    hintShown,
    previewOperator,
    hintText,
    maxAttempts,
    allowGuessAfterAttemptsExhausted,
    allowRevealAnswerAfterAttemptsExhausted,
    hintRevealAfterAttempt,
    attemptsUsed,
    limited,
    showAnswerVisible,
    guessControlsDisabled,
    setTarget,
    setPreview,
    setAttemptRules,
    resetDefaultRules,
    confirm,
    showAnswer,
    saveDailyProgress,
    loadDailyProgress,
    startDaily,
    startRandom,
    startQuestion,
  }
})
