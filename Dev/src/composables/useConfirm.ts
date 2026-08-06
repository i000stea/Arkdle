/**
 * 通用确认弹窗状态（配合 ConfirmModal 使用）
 * 用于需要用户确认的破坏性操作（如退出粥友出题）。
 */
import { reactive } from 'vue'

interface ConfirmState {
  visible: boolean
  message: string
  onConfirm: (() => void) | null
}

const state = reactive<ConfirmState>({
  visible: false,
  message: '',
  onConfirm: null,
})

export function useConfirm() {
  function ask(message: string, onConfirm: () => void): void {
    state.message = message
    state.onConfirm = onConfirm
    state.visible = true
  }

  function cancel(): void {
    state.visible = false
    state.onConfirm = null
  }

  function confirm(): void {
    const cb = state.onConfirm
    state.visible = false
    state.onConfirm = null
    cb?.()
  }

  return { state, ask, cancel, confirm }
}
