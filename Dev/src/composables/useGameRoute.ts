/**
 * 游戏路由编排（对标旧版 Dev/js/route/route_controller.js）
 *
 * 职责：
 * - 解析 URL 参数 → 选路由 → 执行路由 → 写入游戏状态
 * - 每日模式自动恢复历史进度（返回待回放名单，由视图层执行回放）
 * - 模式切换（随机出题 / 本日题目）：更新 URL query 并重启路由
 *
 * 重构要点：旧版通过 window.ArkdleRouteConfig 全局传递路由配置，
 * 这里直接使用 ref 状态，组件可响应式订阅。
 */
import { ref } from 'vue'
import { resolveRoute, getRoute } from '../routes/registry'
import type { RouteContext, RouteType } from '../routes/types'
import { fetchTodayOperator } from '../services/server'
import { useDataStore } from '../stores/data'
import { useGameStore } from '../stores/game'
import type { OperatorMap } from '../types/operator'

/** 从当前 URL 解析路由类型（供首次启动使用） */
export function currentRouteType(): RouteType {
  return resolveRoute(new URLSearchParams(window.location.search))
}

// 模块级单例：所有 useGameRoute() 调用共享同一路由状态（组件间响应式同步）
const routeType = ref<RouteType>(currentRouteType())

function buildRouteContext(operators: OperatorMap): RouteContext {
  return {
    operators,
    fetchTodayOperator,
  }
}

/** 更新 URL 中的路由参数（history.replaceState，保持可分享 URL） */
function rewriteUrl(params: URLSearchParams): void {
  try {
    const url = new URL(window.location.href)
    url.search = ''
    params.forEach((value, key) => url.searchParams.set(key, value))
    window.history.replaceState(null, '', url.toString())
  } catch {
    /* 忽略 URL 写入失败 */
  }
}

export function useGameRoute() {
  const dataStore = useDataStore()
  const gameStore = useGameStore()

  /** 启动本局游戏
   * @returns 每日模式的待回放名单（其余模式为空数组）；失败返回 null
   */
  async function start(): Promise<string[] | null> {
    if (!dataStore.isReady || !dataStore.operatorsData) {
      console.warn('[Route] 干员数据尚未就绪，跳过路由执行')
      return null
    }

    const route = getRoute(routeType.value)
    const ctx = buildRouteContext(dataStore.operatorsData)
    const result = await route.execute(ctx)
    if (!result) return null

    console.log('[Route] 目标干员:', result.name, '| 模式:', routeType.value)

    if (routeType.value === 'daily') {
      return gameStore.startDaily(result.data)
    }
    if (routeType.value === 'random') {
      gameStore.startRandom(result.data)
      return []
    }
    gameStore.startQuestion(result.data)
    return []
  }

  /** 切换到随机出题模式（更新 URL + 重启路由） */
  async function switchToRandom(): Promise<string[] | null> {
    const params = new URLSearchParams(window.location.search)
    params.set('mode', 'random')
    params.delete('daily')
    params.delete('question')
    params.delete('tiquestion')
    rewriteUrl(params)
    routeType.value = 'random'
    return start()
  }

  /** 切换到每日题目模式（更新 URL + 重启路由） */
  async function switchToDaily(): Promise<string[] | null> {
    const params = new URLSearchParams(window.location.search)
    params.delete('mode')
    params.delete('random')
    params.delete('daily')
    params.delete('question')
    params.delete('tiquestion')
    rewriteUrl(params)
    routeType.value = 'daily'
    return start()
  }

  /** 进入粥友出题模式（携带分享 Key，更新 URL + 重启路由） */
  async function switchToQuestion(key: string): Promise<string[] | null> {
    const params = new URLSearchParams(window.location.search)
    params.set('question', key)
    params.delete('mode')
    params.delete('random')
    params.delete('daily')
    params.delete('tiquestion')
    rewriteUrl(params)
    routeType.value = 'question'
    return start()
  }

  return { routeType, start, switchToRandom, switchToDaily, switchToQuestion }
}
