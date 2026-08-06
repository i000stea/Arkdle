<script setup lang="ts">
/**
 * GuessRow - 猜测表的一行（13 列）
 *
 * 用途二合一（迁移自 guessing_item_renderer + rabbit_mode_view）：
 * - 历史行：传入 target 时逐格延迟着色（对比规则见 utils/compare.ts）
 * - 预览行：不传 target，仅展示干员数据，不着色
 *
 * 着色动画：revealIndex 每 50ms 递增，格子在该索引到达时才应用状态 class，
 * 与原版「逐格延迟着色」节奏一致；Vue 中以响应式 class 声明式实现，无 DOM 拼接。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { COLUMNS, columnToField } from '../types/operator'
import type { ColumnDef, FuzzyItemData, Operator } from '../types/operator'
import { compareRow, approxTolerance, findParent, fuzzyTopLevelKey } from '../utils/compare'
import type { CellState } from '../utils/compare'
import { useAppStore } from '../stores/app'
import { useTooltip } from '../composables/useTooltip'

const props = defineProps<{
  guess: Operator
  /** 缺省 = 预览行（不着色） */
  target?: Operator | null
  fuzzy?: FuzzyItemData | null
  /** 是否执行逐格延迟着色（确认/回放的新增行时 true） */
  animate?: boolean
}>()

const appStore = useAppStore()
const { showFuzzy, showApprox, hide: hideTooltip } = useTooltip()

const states = computed<Record<string, CellState> | null>(() => {
  if (!props.target) return null
  return compareRow(props.guess, props.target, props.fuzzy ?? null)
})

const isVictoryRow = computed(() => props.target != null && props.guess.name === props.target.name)

// 逐格延迟着色：-1 起步，每 50ms 递增一格
const revealIndex = ref(-1)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (props.animate) {
    let i = 0
    timer = setInterval(() => {
      revealIndex.value = i++
      if (i >= animTotal.value) {
        if (timer) clearInterval(timer)
        timer = null
      }
    }, 50)
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  timer = null
})

const STATE_CLASS: Record<CellState, string> = {
  equal: 'oper-equal',
  more: 'oper-more',
  less: 'oper-less',
  approximate: 'oper-approximate',
  fuzzy: 'oper-fuzzy',
  different: 'oper-different',
}

// 兔头模式关闭时：非兔头列按顺序重排（grid-column），兔头列隐藏
const rabbitOff = computed(() => !appStore.rabbitModeEnabled)
const nonRabbitSeq = new Map<string, number>()
{
  let seq = 0
  COLUMNS.forEach((col) => {
    if (!col.rabbitStat) {
      seq += 1
      nonRabbitSeq.set(col.key, seq)
    }
  })
}

/**
 * 逐格延迟着色的位次：兔头关闭时仅「可见格」按视觉顺序参与，
 * 隐藏的兔头列不占位，避免变色在中间断层（原版按 13 列顺序跳空）。
 */
const animSeq = computed(() => {
  const map = new Map<string, number>()
  let seq = 0
  COLUMNS.forEach((col) => {
    if (!rabbitOff.value || !col.rabbitStat) {
      map.set(col.key, seq++)
    }
  })
  return map
})
const animTotal = computed(() =>
  rabbitOff.value ? COLUMNS.filter((c) => !c.rabbitStat).length : COLUMNS.length,
)

const cellClass = (index: number, col: ColumnDef, state: CellState | undefined): string[] => {
  const cls: string[] = ['oper-item']
  if (col.rabbitStat) cls.push('rabbit-stat')
  if (state && revealIndex.value >= (animSeq.value.get(col.key) ?? 0)) cls.push(STATE_CLASS[state])
  return cls
}

const cellStyle = (col: ColumnDef): Record<string, string> => {
  if (!rabbitOff.value) return {}
  if (col.rabbitStat) return { display: 'none' }
  return { gridColumn: String(nonRabbitSeq.get(col.key) ?? 1) }
}

// ---- 悬停浮窗（迁移 bindRowTooltip：fuzzy/approximate 格子）----
function onCellEnter(e: MouseEvent, index: number): void {
  const state = states.value?.[COLUMNS[index].key]
  if (!state || !props.target) return

  const col = COLUMNS[index]
  const field = columnToField(col.key)

  if (state === 'fuzzy') {
    const topKey = fuzzyTopLevelKey(col.key)
    const dict = topKey ? (props.fuzzy?.[topKey] ?? undefined) : undefined
    const select = String(props.guess[field] ?? '')
    const parent = findParent(dict, select)
    if (!parent) return
    showFuzzy(
      { select, parent, members: Array.isArray(dict?.[parent]) ? dict[parent] : [] },
      e.clientX,
      e.clientY,
    )
    return
  }

  if (state === 'approximate') {
    const guessVal = String(props.guess[field] ?? '')
    const targetVal = String(props.target[field] ?? '')
    const a = parseFloat(guessVal.replace(/[^0-9.-]/g, ''))
    const b = parseFloat(targetVal.replace(/[^0-9.-]/g, ''))
    const direction: 'more' | 'less' = !Number.isNaN(a) && !Number.isNaN(b) && a > b ? 'more' : 'less'
    showApprox({ guessVal, targetVal, tolerance: approxTolerance(col.key), direction }, e.clientX, e.clientY)
  }
}

function onCellLeave(): void {
  hideTooltip()
}
</script>

<template>
  <div class="guessing-info" :class="{ 'guessing-info--victory': isVictoryRow, 'guessing-info--compact': rabbitOff }">
    <div
      v-for="(col, i) in COLUMNS"
      :key="col.key"
      :data-key="col.key"
      :class="cellClass(i, col, states?.[col.key])"
      :style="cellStyle(col)"
      @mouseenter="onCellEnter($event, i)"
      @mouseleave="onCellLeave"
    >
      {{ col.get(guess) }}
    </div>
  </div>
</template>
