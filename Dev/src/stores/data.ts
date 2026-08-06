/**
 * 数据 Store（对标旧版 data_manager.js 的 state）
 *
 * 职责：持有干员数据 / 模糊词典 / 版本信息的响应式状态。
 * 加载流程（版本校验 + 缓存）在 composables/useDataLoader.ts 中实现。
 *
 * 重构要点：旧版通过 window CustomEvent('arkdle:data:*') 广播状态，
 * Vue 中 ref 本身就是响应式，消费方直接 watch / computed 本 store 即可，事件总线被移除。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OperatorMap, FuzzyItemData } from '../types/operator'

export const STORAGE_KEYS = {
  OPERATORS: 'arkdle_operators_data',
  FUZZY_ITEM: 'arkdle_fuzzy_item_data',
  CONFIG_VERSION: 'arkdle_cached_config_version',
  APP_VERSION: 'arkdle_cached_app_version',
} as const

export const useDataStore = defineStore('data', () => {
  const operatorsData = ref<OperatorMap | null>(null)
  const fuzzyItemData = ref<FuzzyItemData | null>(null)
  const configVersion = ref<number | null>(null)
  const appVersion = ref<string | null>(null)
  const isLoading = ref(false)
  const useCache = ref(false)
  const error = ref<string | null>(null)

  /** 干员数据是否就绪（非空集合） */
  const isReady = computed(() => !!operatorsData.value && Object.keys(operatorsData.value).length > 0)

  return {
    operatorsData,
    fuzzyItemData,
    configVersion,
    appVersion,
    isLoading,
    useCache,
    error,
    isReady,
  }
})
