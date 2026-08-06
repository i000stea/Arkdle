/**
 * 日期工具：统一 Asia/Shanghai 时区
 * 与后端 api/server.php 的 date_default_timezone_set('Asia/Shanghai') 保持一致，
 * 避免跨日边界时前后端日期不一致。
 */

/** 获取 Asia/Shanghai 时区的今日日期，格式 YYYY-MM-DD */
export function getTodayStr(): string {
  try {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
  } catch {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
}
