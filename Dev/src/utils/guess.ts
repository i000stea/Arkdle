/**
 * 干员数据查找工具（迁移自 play_controller.findOperatorByNameOrEnglish）
 * 统一所有「输入 → 干员数据」的映射路径：中文名 key 直查 → englishName 兜底。
 */
import type { Operator, OperatorMap } from '../types/operator'

export function findOperatorByNameOrEnglish(data: OperatorMap | null, name: string): Operator | null {
  if (!data || Object.keys(data).length === 0) return null
  const trimmed = (name || '').trim()
  if (!trimmed) return null

  // 1) 中文名 key 直查：最快路径
  const direct = data[trimmed]
  if (direct) return direct

  // 2) englishName 查找（忽略大小写）
  const lower = trimmed.toLowerCase()
  for (const key in data) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue
    const op = data[key]
    if (op.englishName && op.englishName.toLowerCase() === lower) return op
  }

  return null
}
