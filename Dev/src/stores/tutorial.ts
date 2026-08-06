/**
 * 教程状态 Store（迁移自 tutorial_model）
 * 含 30 天自动重显逻辑与「已显示」标记。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

const TUTORIAL_LAST_OPEN_KEY = 'arkdle_last_open_timestamp'
const TUTORIAL_RESHOW_AFTER_MS = 30 * 24 * 60 * 60 * 1000

export const useTutorialStore = defineStore('tutorial', () => {
  const visible = ref(false)

  function open(): void {
    visible.value = true
  }

  function close(): void {
    visible.value = false
  }

  /** 是否应该自动显示教程（首次访问或超过 30 天未打开） */
  function shouldAutoShow(): boolean {
    const now = Date.now()
    let shouldAutoShow = false

    try {
      const lastOpenStr = localStorage.getItem(TUTORIAL_LAST_OPEN_KEY)
      if (lastOpenStr) {
        const lastOpen = parseInt(lastOpenStr, 10)
        shouldAutoShow = !(Number.isFinite(lastOpen) && now - lastOpen <= TUTORIAL_RESHOW_AFTER_MS)
      } else {
        const legacyShown = localStorage.getItem('arkdle_tutorial_shown')
        shouldAutoShow = !legacyShown
      }
      localStorage.setItem(TUTORIAL_LAST_OPEN_KEY, String(now))
    } catch {
      /* 忽略 localStorage 异常 */
    }

    return shouldAutoShow
  }

  /** 标记教程已显示（30 天内不再自动弹出） */
  function markShown(): void {
    try {
      localStorage.setItem('arkdle_tutorial_shown', 'true')
      if (!localStorage.getItem('arkdle_first_visit_time')) {
        localStorage.setItem('arkdle_first_visit_time', String(Date.now()))
      }
    } catch {
      /* 忽略 */
    }
  }

  return { visible, open, close, shouldAutoShow, markShown }
})
