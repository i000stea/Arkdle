/**
 * 服务器服务（对标旧版 Dev/js/server/server.js）
 * 仅负责网络请求，缓存策略由 daily 路由管理。
 */

export interface TodayOperatorResult {
  success: boolean
  operator: string | null
  date: string
  error?: string
}

const SERVER_URL = 'https://arkdle.milletea.top/api/server.php'

/** 获取今日干员名称（后端按 Asia/Shanghai 时区计算） */
export async function fetchTodayOperator(): Promise<TodayOperatorResult> {
  try {
    const response = await fetch(SERVER_URL, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const result = await response.json()
    const data = result?.data
    const operator = data?.todayOperatorName || null
    const date = data?.todayDate || new Date().toISOString().slice(0, 10)

    if (operator) {
      return { success: true, operator, date }
    }
    return { success: false, operator: null, date, error: '服务器未返回今日干员名称' }
  } catch (error) {
    console.error('[Server] 查询今日干员失败:', error)
    return {
      success: false,
      operator: null,
      date: new Date().toISOString().slice(0, 10),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
