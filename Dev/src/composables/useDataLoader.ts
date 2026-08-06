/**
 * 数据加载器（对标旧版 data_manager.js 的完整加载流程）
 *
 * 流程：
 * 1. 获取云端版本配置（configVersion / appVersion）
 * 2. 与本地缓存版本对比：
 *    - 一致且缓存完整 → 直接使用缓存，不请求数据
 *    - 不一致 → 并行拉取干员数据 + 模糊词典，写回缓存
 * 3. 失败降级：仅使用本地缓存
 *
 * 资源路径说明：
 * - 生产：构建产物与 resource/ 同层部署，URL 为 `${BASE_URL}resource/xxx.json`
 * - 开发：由 vite.config.ts 的 serveParentResource 插件将 /resource/* 映射到项目根目录
 */
import { useDataStore, STORAGE_KEYS } from '../stores/data'
import { readStorage, writeStorage } from '../utils/storage'
import type { OperatorMap, FuzzyItemData, VersionConfig } from '../types/operator'

const resourceBase = `${import.meta.env.BASE_URL}resource/`

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function useDataLoader() {
  const store = useDataStore()

  const loadVersion = (): Promise<VersionConfig> => fetchJson<VersionConfig>(`${resourceBase}config_version.json`)

  const loadOperators = (): Promise<OperatorMap> => fetchJson<OperatorMap>(`${resourceBase}data_Operators.json`)

  const loadFuzzyItem = (): Promise<FuzzyItemData> => fetchJson<FuzzyItemData>(`${resourceBase}data_FuzzyItem.json`)

  /** 版本一致且缓存完整 → 恢复缓存并返回 true；否则返回 false 需要重新拉取 */
  function compareVersion(cloudVersion: VersionConfig): boolean {
    const cachedVersion = readStorage<number>(STORAGE_KEYS.CONFIG_VERSION)

    if (cachedVersion === null || cachedVersion !== cloudVersion.configVersion) {
      console.log('[数据] 版本不一致（本地:', cachedVersion, '云端:', cloudVersion.configVersion, '）')
      return false
    }

    const cachedOperators = readStorage<OperatorMap>(STORAGE_KEYS.OPERATORS)
    const cachedFuzzy = readStorage<FuzzyItemData>(STORAGE_KEYS.FUZZY_ITEM)
    if (cachedOperators && cachedFuzzy) {
      console.log('[数据] 版本一致，使用本地缓存')
      store.operatorsData = cachedOperators
      store.fuzzyItemData = cachedFuzzy
      store.configVersion = cloudVersion.configVersion
      store.appVersion = cloudVersion.appVersion
      store.useCache = true
      return true
    }

    console.log('[数据] 版本一致但缓存不完整，需要重新加载')
    return false
  }

  function cacheData(operators: OperatorMap, fuzzyItem: FuzzyItemData, version: VersionConfig): void {
    writeStorage(STORAGE_KEYS.OPERATORS, operators)
    writeStorage(STORAGE_KEYS.FUZZY_ITEM, fuzzyItem)
    writeStorage(STORAGE_KEYS.CONFIG_VERSION, version.configVersion)
    writeStorage(STORAGE_KEYS.APP_VERSION, version.appVersion)

    store.operatorsData = operators
    store.fuzzyItemData = fuzzyItem
    store.configVersion = version.configVersion
    store.appVersion = version.appVersion
  }

  /** 主加载流程（带版本校验与缓存策略） */
  async function loadData(): Promise<void> {
    if (store.isLoading) {
      console.warn('[数据] 正在加载中，跳过重复请求')
      return
    }

    store.isLoading = true
    store.error = null

    try {
      const cloudVersion = await loadVersion()

      if (compareVersion(cloudVersion)) {
        store.isLoading = false
        return
      }

      console.log('[数据] 需要重新加载干员数据')
      const [operators, fuzzyItem] = await Promise.all([loadOperators(), loadFuzzyItem()])
      cacheData(operators, fuzzyItem, cloudVersion)
      console.log('[数据] 数据加载完成，共', Object.keys(operators).length, '个干员')
    } catch (error) {
      console.error('[数据] 数据加载失败:', error)
      store.error = error instanceof Error ? error.message : String(error)
    } finally {
      store.isLoading = false
    }
  }

  /** 仅使用本地缓存（离线/快速启动降级） */
  function loadFromCacheOnly(): void {
    const cachedOperators = readStorage<OperatorMap>(STORAGE_KEYS.OPERATORS)
    const cachedFuzzy = readStorage<FuzzyItemData>(STORAGE_KEYS.FUZZY_ITEM)
    const cachedVersion = readStorage<number>(STORAGE_KEYS.CONFIG_VERSION)
    const cachedAppVersion = readStorage<string>(STORAGE_KEYS.APP_VERSION)

    if (cachedOperators) {
      store.operatorsData = cachedOperators
      store.fuzzyItemData = cachedFuzzy
      store.configVersion = cachedVersion
      store.appVersion = cachedAppVersion
      store.useCache = true
      console.log('[数据] 从本地缓存恢复数据')
    } else {
      console.warn('[数据] 本地无缓存数据')
    }
  }

  return { loadData, loadFromCacheOnly }
}
