/**
 * 每日题目路由（对标旧版 Dev/js/route/daily_route.js）
 *
 * 策略：
 * 1. 读取本地缓存 { date, operator }
 * 2. 缓存命中且 date === 今日（Asia/Shanghai）→ 直接使用
 * 3. 否则请求云端，写入缓存后使用
 */
import type { GameRoute, RouteContext, RouteResult } from './types'
import { getTodayStr } from '../utils/date'
import { readStorage, writeStorage } from '../utils/storage'

const DAILY_CACHE_KEY = 'arkdle_daily_operator_cache'

interface DailyOperatorCache {
  date: string
  operator: string
}

function readCache(): DailyOperatorCache | null {
  const obj = readStorage<DailyOperatorCache>(DAILY_CACHE_KEY)
  if (!obj || typeof obj.date !== 'string' || typeof obj.operator !== 'string') return null
  return obj
}

export const dailyRoute: GameRoute = {
  routeType: 'daily',
  priority: 100,
  // 兜底路由：任何未被其他路由匹配的情况均由 daily 接管
  match: () => false,

  async execute(ctx: RouteContext): Promise<RouteResult | null> {
    const today = getTodayStr()

    const cache = readCache()
    if (cache && cache.date === today && cache.operator) {
      const data = ctx.operators[cache.operator]
      if (data) {
        console.log('[DailyRoute] 使用今日缓存干员:', cache.operator)
        return { name: cache.operator, data }
      }
    }

    console.log('[DailyRoute] 缓存未命中，请求云端')
    const result = await ctx.fetchTodayOperator()
    if (!result.success || !result.operator) {
      console.warn('[DailyRoute] 云端请求失败:', result.error)
      return null
    }

    const data = ctx.operators[result.operator]
    if (!data) {
      console.warn('[DailyRoute] 干员数据中未找到:', result.operator)
      return null
    }

    writeStorage(DAILY_CACHE_KEY, { date: today, operator: result.operator })
    console.log('[DailyRoute] 云端返回并写入缓存:', result.operator)
    return { name: result.operator, data }
  },
}
