/**
 * 浮窗组合式函数（迁移自 tooltip_controller + tooltip_model）
 * 模块级响应式状态：Tooltip.vue 渲染，GuessRow 悬停时调用 show 与 hide。
 */
import { reactive } from 'vue'

export interface FuzzyPayload {
  select: string
  parent: string
  members: string[]
}

export interface ApproxPayload {
  guessVal: string
  targetVal: string
  tolerance: number
  direction: 'more' | 'less'
}

interface TooltipState {
  visible: boolean
  type: 'fuzzy' | 'approx' | null
  x: number
  y: number
  fuzzyPayload: FuzzyPayload | null
  approxPayload: ApproxPayload | null
}

const state = reactive<TooltipState>({
  visible: false,
  type: null,
  x: 0,
  y: 0,
  fuzzyPayload: null,
  approxPayload: null,
})

export function useTooltip() {
  function showFuzzy(payload: FuzzyPayload, x: number, y: number): void {
    state.visible = true
    state.type = 'fuzzy'
    state.x = x
    state.y = y
    state.fuzzyPayload = payload
    state.approxPayload = null
  }

  function showApprox(payload: ApproxPayload, x: number, y: number): void {
    state.visible = true
    state.type = 'approx'
    state.x = x
    state.y = y
    state.fuzzyPayload = null
    state.approxPayload = payload
  }

  function hide(): void {
    state.visible = false
    state.type = null
  }

  return { state, showFuzzy, showApprox, hide }
}
