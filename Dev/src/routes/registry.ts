/**
 * 路由注册表（对标旧版 Dev/js/route/route_module.js）
 * 按 priority 排序，resolve() 返回第一个 match 的路由；无匹配时兜底 daily。
 */
import type { GameRoute, RouteType } from './types'
import { dailyRoute } from './daily'
import { randomRoute } from './random'
import { questionRoute } from './question'

const registry: GameRoute[] = [questionRoute, randomRoute, dailyRoute].sort((a, b) => a.priority - b.priority)

export function resolveRoute(params: URLSearchParams): RouteType {
  for (const route of registry) {
    if (route.match(params)) return route.routeType
  }
  return 'daily'
}

export function getRoute(type: RouteType): GameRoute {
  return registry.find((r) => r.routeType === type) ?? dailyRoute
}
