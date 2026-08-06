/**
 * 随机题目路由（对标旧版 Dev/js/route/random_route.js）
 * 接管条件：URL 含有 mode=random 或 random 参数
 */
import type { GameRoute, RouteContext, RouteResult } from './types'

export const randomRoute: GameRoute = {
  routeType: 'random',
  priority: 20,

  match(params: URLSearchParams): boolean {
    const mode = (params.get('mode') || '').trim().toLowerCase()
    return mode === 'random' || params.has('random')
  },

  async execute(ctx: RouteContext): Promise<RouteResult | null> {
    const names = Object.keys(ctx.operators)
    if (names.length === 0) {
      console.warn('[RandomRoute] 干员数据尚未加载')
      return null
    }

    const randomName = names[Math.floor(Math.random() * names.length)]
    const randomOperator = ctx.operators[randomName]
    if (!randomOperator) return null

    console.log('[RandomRoute] 随机选择干员:', randomName)
    return { name: randomName, data: randomOperator }
  },
}
