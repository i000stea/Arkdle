/**
 * 路由层类型定义（对标旧版 Dev/js/route/route_module.js 的注册表设计）
 *
 * 路由职责：根据 URL 参数决定本局目标干员。
 * 路由不感知游戏状态，只返回目标；状态写入由 useGameRoute 编排完成。
 */
import type { Operator, OperatorMap } from '../types/operator'
import type { TodayOperatorResult } from '../services/server'

export type RouteType = 'daily' | 'random' | 'question'

/** 路由执行上下文：只读数据 + 外部依赖，由 useGameRoute 注入 */
export interface RouteContext {
  operators: OperatorMap
  fetchTodayOperator(): Promise<TodayOperatorResult>
}

/** 路由执行结果 */
export interface RouteResult {
  name: string
  data: Operator
}

export interface GameRoute {
  readonly routeType: RouteType
  /** 数字越小越优先匹配 */
  readonly priority: number
  /** 是否接管当前 URL */
  match(params: URLSearchParams): boolean
  /** 选择目标干员；失败返回 null（由编排层降级处理） */
  execute(ctx: RouteContext): Promise<RouteResult | null>
}
