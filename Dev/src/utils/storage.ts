/**
 * localStorage 安全封装：JSON 序列化 + 异常兜底
 * 所有持久化读写统一走这里，避免 try/catch 散落各处。
 */

export function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (e) {
    console.warn('[storage] 读取缓存失败:', key, e)
    return null
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('[storage] 写入缓存失败:', key, e)
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn('[storage] 删除缓存失败:', key, e)
  }
}
