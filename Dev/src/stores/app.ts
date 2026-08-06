/**
 * 应用偏好 Store（对标旧版 AppModel 的输入与兔头模式状态）
 * rabbitModeEnabled 持久化到 localStorage。
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const RABBIT_MODE_STORAGE_KEY = 'arkdle_rabbit_mode_on'

function readRabbitPreference(): boolean {
  try {
    const v = localStorage.getItem(RABBIT_MODE_STORAGE_KEY)
    if (v === null) return true
    return v === '1' || v === 'true'
  } catch {
    return true
  }
}

export const useAppStore = defineStore('app', () => {
  const inputName = ref('')
  const rabbitModeEnabled = ref(readRabbitPreference())

  watch(rabbitModeEnabled, (enabled) => {
    try {
      localStorage.setItem(RABBIT_MODE_STORAGE_KEY, enabled ? '1' : '0')
    } catch {
      /* 忽略持久化失败 */
    }
  })

  function setInputName(value: string): void {
    inputName.value = value
  }

  function toggleRabbitMode(): void {
    rabbitModeEnabled.value = !rabbitModeEnabled.value
  }

  return { inputName, rabbitModeEnabled, setInputName, toggleRabbitMode }
})
