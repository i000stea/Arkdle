/**
 * 粥友出题路由（迁移自 js/question_mode.js）
 * 接管条件：URL 含有 question 或 tiquestion 参数
 *
 * 流程：加载题包 → 显示封面 Overlay → 返回第一题目标给编排层。
 * 后续逐题推进由 QuizPackOverlay / App 的「进入下一题」按钮驱动 quiz store。
 */
import type { GameRoute, RouteContext, RouteResult } from './types'
import { useQuizStore } from '../stores/quiz'

function getQuestionParam(params: URLSearchParams): string {
  return params.get('question') || params.get('tiquestion') || ''
}

export const questionRoute: GameRoute = {
  routeType: 'question',
  priority: 10,

  match(params: URLSearchParams): boolean {
    return params.has('question') || params.has('tiquestion')
  },

  async execute(ctx: RouteContext): Promise<RouteResult | null> {
    const key = getQuestionParam(new URLSearchParams(window.location.search))
    if (!key) return null

    const quizStore = useQuizStore()
    const ok = await quizStore.load(key)
    if (!ok) return null

    return quizStore.startQuestion(0)
  },
}
