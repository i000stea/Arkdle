/**
 * 逐格对比纯函数（迁移自 Dev/js/play/guessing_item_renderer.js 的 verifyRow 规则）
 *
 * 将旧的命令式 DOM 着色（applyNumericClass + applyFuzzyClass + 逐列延迟动画）
 * 改为纯函数：一次算出 13 列的状态，组件用 computed 声明式渲染。
 * 逐格延迟动画由组件层用 revealIndex + transition-delay 实现。
 */
import { COLUMNS, columnToField } from '../types/operator'
import type { FuzzyItemData, Operator } from '../types/operator'

export type CellState = 'equal' | 'more' | 'less' | 'approximate' | 'fuzzy' | 'different'

interface CompareRule {
  kind: 'exact' | 'numeric' | 'fuzzy'
  tolerance?: number
  fuzzyKey?: keyof FuzzyItemData
}

/** 各列对比规则（与原版 verify 完全对齐） */
const RULES: Record<string, CompareRule> = {
  'oper-name': { kind: 'exact' },
  'oper-profession': { kind: 'exact' },
  'oper-hp': { kind: 'numeric', tolerance: 100 },
  'oper-atk': { kind: 'numeric', tolerance: 10 },
  'oper-def': { kind: 'numeric', tolerance: 10 },
  'oper-res': { kind: 'numeric', tolerance: 0 },
  'oper-reDeploy': { kind: 'numeric', tolerance: 5 },
  'oper-cost': { kind: 'numeric', tolerance: 1 },
  'oper-block': { kind: 'numeric', tolerance: 0 },
  'oper-position': { kind: 'exact' },
  'oper-Campus': { kind: 'fuzzy', fuzzyKey: 'CampusVague' },
  'oper-Origin': { kind: 'fuzzy', fuzzyKey: 'OriginVague' },
  'oper-Race': { kind: 'fuzzy', fuzzyKey: 'RaceVague' },
}

/** 去除非数值字符后转 float（与原版 toNumeric 一致：保留数字、小数点、负号） */
export function toNumeric(value: unknown): number {
  return parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''))
}

/** 查找值所属的父分类（用于模糊判断与 tooltip 成员列表） */
export function findParent(dict: Record<string, string[]> | undefined, val: string): string | null {
  if (!dict || typeof dict !== 'object') return null
  for (const parent in dict) {
    if (!Object.prototype.hasOwnProperty.call(dict, parent)) continue
    const items = dict[parent]
    if (Array.isArray(items) && items.includes(val)) return parent
  }
  return null
}

function compareExact(g: unknown, t: unknown): CellState {
  return g === t ? 'equal' : 'different'
}

function compareNumeric(g: unknown, t: unknown, tolerance: number): CellState {
  const a = toNumeric(g)
  const b = toNumeric(t)

  if (Number.isNaN(a) || Number.isNaN(b)) {
    return String(g) === String(t) ? 'equal' : 'different'
  }
  if (a === b) return 'equal'
  if (tolerance > 0 && Math.abs(a - b) < tolerance) return 'approximate'
  return a > b ? 'more' : 'less'
}

function compareFuzzy(g: unknown, t: unknown, dict: Record<string, string[]> | undefined): CellState {
  if (g === t) return 'equal'
  const gStr = String(g ?? '')
  const tStr = String(t ?? '')
  if (!gStr || !tStr) return 'different'

  const parentG = findParent(dict, gStr)
  const parentT = findParent(dict, tStr)
  if (parentG && parentT && parentG === parentT) return 'fuzzy'
  return 'different'
}

/** 对比单个单元格 */
export function compareCell(key: string, guess: Operator, target: Operator, fuzzy: FuzzyItemData | null): CellState {
  const rule = RULES[key]
  if (!rule) return 'different'

  const field = columnToField(key)
  const g = guess[field]
  const t = target[field]

  switch (rule.kind) {
    case 'exact':
      return compareExact(g, t)
    case 'numeric':
      return compareNumeric(g, t, rule.tolerance ?? 0)
    case 'fuzzy': {
      const dict = rule.fuzzyKey ? (fuzzy?.[rule.fuzzyKey] ?? undefined) : undefined
      return compareFuzzy(g, t, dict)
    }
  }
}

/** 一次算出整行 13 列的状态（组件 computed 消费） */
export function compareRow(guess: Operator, target: Operator, fuzzy: FuzzyItemData | null): Record<string, CellState> {
  const states: Record<string, CellState> = {}
  for (const col of COLUMNS) {
    states[col.key] = compareCell(col.key, guess, target, fuzzy)
  }
  return states
}

/** 数值列容差（tooltip 展示「相差在 x 以内」用） */
export function approxTolerance(key: string): number {
  const rule = RULES[key]
  return rule?.kind === 'numeric' ? (rule.tolerance ?? 0) : 0
}

/** 模糊列对应词典顶层键（tooltip 取成员列表用） */
export function fuzzyTopLevelKey(key: string): keyof FuzzyItemData | null {
  const rule = RULES[key]
  return rule?.kind === 'fuzzy' ? (rule.fuzzyKey ?? null) : null
}
