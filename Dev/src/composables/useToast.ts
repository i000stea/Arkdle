/**
 * 顶部吐司（Toast）—— 模块级响应式状态
 * 用于轻量提示（如「该题目不允许兔头！」）。
 */
import { reactive } from 'vue'

export interface ToastItem {
  id: number
  message: string
}

const toasts = reactive<ToastItem[]>([])
let seq = 0

export function useToast() {
  function show(message: string, duration = 2500): void {
    const id = ++seq
    toasts.push({ id, message })
    setTimeout(() => {
      const index = toasts.findIndex((t) => t.id === id)
      if (index >= 0) toasts.splice(index, 1)
    }, duration)
  }

  return { toasts, show }
}
