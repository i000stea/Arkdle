/**
 * 干员名称模糊搜索纯算法（迁移自 Dev/js/fuzzy/fuzzy_search_engine.js）
 *
 * 搜索字段：中文名(key) / englishName / pinyinAll / pinyinFirst
 * 排序：分数高 → 命中位置早 → 名称短 → 中文 localeCompare
 */
import type { OperatorMap } from '../types/operator'

function normalize(s: unknown): string {
  return (s || '').toString().toLowerCase()
}

/** 根据 searchTerm 返回匹配的干员中文名列表（已排序，分数降序） */
export function searchOperators(operatorsData: OperatorMap | null, searchTerm: string): string[] {
  if (!searchTerm || !operatorsData || Object.keys(operatorsData).length === 0) {
    return []
  }

  const term = normalize(searchTerm.trim())
  const termNoSpace = term.replace(/\s+/g, '')
  if (!term) return []

  const results: { name: string; score: number; pos: number; len: number }[] = []

  for (const name in operatorsData) {
    if (!Object.prototype.hasOwnProperty.call(operatorsData, name)) continue
    const op = operatorsData[name]

    const cn = normalize(name)
    const en = normalize(op.englishName)
    const pAll = normalize(op.pinyinAll)
    const pAllNoSpace = pAll.replace(/\s+/g, '')
    const pFirst = normalize(op.pinyinFirst)

    let score = 0
    let bestPos = Infinity

    // 1) 精确匹配
    if (cn === term) { score = Math.max(score, 100); bestPos = 0 }
    if (en && en === term) { score = Math.max(score, 98); bestPos = 0 }
    if (pFirst && pFirst === term) { score = Math.max(score, 97); bestPos = 0 }
    if (pAll && pAllNoSpace === termNoSpace) { score = Math.max(score, 96); bestPos = 0 }

    // 2) 前缀匹配
    if (!score) {
      if (cn.startsWith(term)) { score = Math.max(score, 90); bestPos = 0 }
      if (en && en.startsWith(term)) { score = Math.max(score, 88); bestPos = 0 }
      if (pFirst && pFirst.startsWith(term)) { score = Math.max(score, 87); bestPos = 0 }
      if (pAll && pAllNoSpace.startsWith(termNoSpace)) { score = Math.max(score, 86); bestPos = 0 }
    }

    // 3) 子串匹配
    if (!score) {
      const posCN = cn.indexOf(term)
      const posEN = en ? en.indexOf(term) : -1
      const posPF = pFirst ? pFirst.indexOf(term) : -1
      const posPA = pAllNoSpace ? pAllNoSpace.indexOf(termNoSpace) : -1

      if (posCN >= 0) { score = Math.max(score, 80); bestPos = Math.min(bestPos, posCN) }
      if (posEN >= 0) { score = Math.max(score, 78); bestPos = Math.min(bestPos, posEN) }
      if (posPF >= 0) { score = Math.max(score, 77); bestPos = Math.min(bestPos, posPF) }
      if (posPA >= 0) { score = Math.max(score, 76); bestPos = Math.min(bestPos, posPA) }
    }

    if (score > 0) {
      results.push({ name, score, pos: bestPos, len: name.length })
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.pos !== b.pos) return a.pos - b.pos
    if (a.len !== b.len) return a.len - b.len
    return a.name.localeCompare(b.name, 'zh')
  })

  return results.map((r) => r.name)
}
