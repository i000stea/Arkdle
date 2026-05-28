/**
 * 数据管理模块 - MVC 中的 Model 层辅助
 * 
 * 职责：从云端获取干员数据和配置版本，缓存到 localStorage，
 * 版本号相同时使用本地缓存避免重复请求。
 * 
 * 技术要点（MVC-Model 层）
 * - 使用 Promise 链式加载：先获取版本号 → 对比本地 → 决定是否拉取数据
 * - localStorage 持久化：operatorsData、configVersion、appVersion
 * - 版本对比逻辑：configVersion 变更时清空数据缓存重新加载
 * 
 * 数据流
 * 1. loadVersion() → 获取云端 configVersion + appVersion
 * 2. compareVersion() → 对比 localStorage 中的缓存版本
 * 3. loadOperators() → 版本不一致时从云端拉取干员数据
 * 4. cacheData() → 写入 localStorage 供后续使用
 * 
 * 输出事件
 * - 'arkdle:data:loaded' : 数据加载完成
 * - 'arkdle:data:version-mismatch' : 版本不一致，已重新加载
 * - 'arkdle:data:using-cache' : 使用本地缓存，未请求云端
 */

(() => {
    'use strict';

    // ============================================================
    // 配置常量
    // ============================================================
    const STORAGE_KEYS = {
        OPERATORS: 'arkdle_operators_data',       // 干员数据缓存
        FUZZY_ITEM: 'arkdle_fuzzy_item_data',
        CONFIG_VERSION: 'arkdle_cached_config_version',  // 配置版本号
        APP_VERSION: 'arkdle_cached_app_version',  // 应用版本号
    };

    // 相对路径：从 Refactor 目录访问根目录的 resource 文件
    const CLOUD_URLS = {
        VERSION: '../resource/config_version.json',     // 版本配置文件
        OPERATORS: '../resource/data_Operators.json',   // 干员数据文件
        FUZZY_ITEM: '../resource/data_FuzzyItem.json',
    };

    // ============================================================
    // 工具函数：localStorage 封装
    // ============================================================

    /** 读取 localStorage 中的数据 */
    const getStorage = (key) => {
        try {
            const raw = localStorage.getItem(key);
            console.log('[数据管理] 读取缓存:', key);
            // console.log('[数据管理] 读取缓存:', raw);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('[数据管理] 读取缓存失败:', key, e);
            return null;
        }
    };

    /** 写入数据到 localStorage */
    const setStorage = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            console.log('[数据管理] 缓存写入成功:', key);
        } catch (e) {
            console.warn('[数据管理] 缓存写入失败:', key, e);
        }
    };

    /** 获取缓存的配置版本号 */
    const getCachedConfigVersion = () => {
        return getStorage(STORAGE_KEYS.CONFIG_VERSION);
    };

    /** 获取缓存的干员数据 */
    const getCachedOperators = () => {
        return getStorage(STORAGE_KEYS.OPERATORS);
    };

    /** 获取缓存的 appVersion */
    const getCachedAppVersion = () => {
        return getStorage(STORAGE_KEYS.APP_VERSION);
    };

    /** 获取缓存的模糊匹配分类数据 */
    const getCachedFuzzyItem = () => {
        return getStorage(STORAGE_KEYS.FUZZY_ITEM);
    };

    // ============================================================
    // 模型状态（内部使用）
    // ============================================================
    let state = {
        operatorsData: null,
        fuzzyItemData: null,
        configVersion: null,
        appVersion: null,
        isLoading: false,
        useCache: false,
    };

    // ============================================================
    // 核心方法：获取版本号
    // ============================================================

    /**
     * 从云端获取版本配置
     * @returns {Promise<Object>} { configVersion, appVersion }
     */
    const loadVersion = async () => {
        try {
            const response = await fetch(CLOUD_URLS.VERSION);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('[数据管理] 版本配置获取成功:', data);
            return {
                configVersion: data.configVersion,
                appVersion: data.appVersion,
            };
        } catch (error) {
            console.error('[数据管理] 获取版本配置失败:', error);
            throw error;
        }
    };

    // ============================================================
    // 核心方法：获取干员数据
    // ============================================================

    /**
     * 从云端获取干员数据
     * @returns {Promise<Object>} 干员数据对象
     */
    const loadOperators = async () => {
        try {
            const response = await fetch(CLOUD_URLS.OPERATORS);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('[数据管理] 干员数据获取成功，共', Object.keys(data).length, '个干员');
            return data;
        } catch (error) {
            console.error('[数据管理] 获取干员数据失败:', error);
            throw error;
        }
    };

    /**
     * 从云端获取模糊匹配分类数据
     * @returns {Promise<Object>}
     */
    const loadFuzzyItem = async () => {
        try {
            const response = await fetch(CLOUD_URLS.FUZZY_ITEM);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('[数据管理] 模糊分类数据获取成功');
            return data;
        } catch (error) {
            console.error('[数据管理] 获取模糊分类数据失败:', error);
            throw error;
        }
    };

    // ============================================================
    // 核心方法：版本对比与缓存策略
    // ============================================================

    /**
     * 对比云端版本与本地缓存版本
     * @param {Object} cloudVersion - 云端版本 { configVersion, appVersion }
     * @returns {boolean} true=版本一致且使用缓存, false=需要重新加载
     */
    const compareVersion = (cloudVersion) => {
        const cachedVersion = getCachedConfigVersion();

        // 首次使用或版本不一致
        if (cachedVersion === null || cachedVersion !== cloudVersion.configVersion) {
            console.log('[数据管理] 版本不一致（本地:', cachedVersion, '云端:', cloudVersion.configVersion, '）');
            return false;
        }

        // 版本一致，尝试使用本地缓存
        console.log('[数据管理] 版本一致，使用本地缓存');
        state.useCache = true;
        state.configVersion = cloudVersion.configVersion;
        state.appVersion = cloudVersion.appVersion;

        const cachedOperators = getCachedOperators();
        const cachedFuzzy = getCachedFuzzyItem();
        if (cachedOperators && cachedFuzzy) {
            state.operatorsData = cachedOperators;
            state.fuzzyItemData = cachedFuzzy;
            console.log('[数据管理] 本地缓存数据已恢复，共', Object.keys(cachedOperators).length, '个干员');
            return true;
        }

        console.log('[数据管理] 版本一致但缓存数据不完整，需要重新加载');
        return false;
    };

    // ============================================================
    // 核心方法：缓存数据
    // ============================================================

    /**
     * 将数据和版本号写入 localStorage 缓存
     * @param {Object} operators - 干员数据
     * @param {Object} fuzzyItem - 模糊分类数据
     * @param {Object} version - 版本信息 { configVersion, appVersion }
     */
    const cacheData = (operators, fuzzyItem, version) => {
        setStorage(STORAGE_KEYS.OPERATORS, operators);
        setStorage(STORAGE_KEYS.FUZZY_ITEM, fuzzyItem);
        setStorage(STORAGE_KEYS.CONFIG_VERSION, version.configVersion);
        setStorage(STORAGE_KEYS.APP_VERSION, version.appVersion);

        state.operatorsData = operators;
        state.fuzzyItemData = fuzzyItem;
        state.configVersion = version.configVersion;
        state.appVersion = version.appVersion;
    };

    // ============================================================
    // 主加载流程
    // ============================================================

    /**
     * 主入口：加载数据（带版本检查）
     * @returns {Promise<Object>} 加载完成后的状态
     */
    const loadData = async () => {
        if (state.isLoading) {
            console.warn('[数据管理] 正在加载中，跳过重复请求');
            return state;
        }

        state.isLoading = true;

        try {
            // 1. 获取云端版本
            const cloudVersion = await loadVersion();

            // 2. 对比版本，决定是否使用缓存
            const useCache = compareVersion(cloudVersion);

            if (useCache) {
                // 使用本地缓存，不请求干员数据
                window.dispatchEvent(new CustomEvent('arkdle:data:using-cache'));
                state.isLoading = false;
                return state;
            }

            console.log('[数据管理] 需要重新加载干员数据');
            window.dispatchEvent(new CustomEvent('arkdle:data:version-mismatch'));

            const [operators, fuzzyItem] = await Promise.all([
                loadOperators(),
                loadFuzzyItem(),
            ]);

            cacheData(operators, fuzzyItem, cloudVersion);

            window.dispatchEvent(new CustomEvent('arkdle:data:loaded', {
                detail: {
                    operators: operators,
                    fuzzyItem: fuzzyItem,
                    configVersion: cloudVersion.configVersion,
                    appVersion: cloudVersion.appVersion,
                }
            }));

            console.log('[数据管理] 数据加载完成');
            return state;

        } catch (error) {
            console.error('[数据管理] 数据加载失败:', error);
            state.isLoading = false;
            throw error;
        }
    };

    /**
     * 仅使用本地缓存（不请求云端）
     * 用于离线模式或快速启动
     */
    const loadFromCacheOnly = () => {
        const cachedOperators = getCachedOperators();
        const cachedFuzzy = getCachedFuzzyItem();
        const cachedVersion = getCachedConfigVersion();
        const cachedAppVersion = getCachedAppVersion();

        if (cachedOperators) {
            state.operatorsData = cachedOperators;
            state.fuzzyItemData = cachedFuzzy;
            state.configVersion = cachedVersion;
            state.appVersion = cachedAppVersion;
            state.useCache = true;
            console.log('[数据管理] 从本地缓存恢复数据');
            window.dispatchEvent(new CustomEvent('arkdle:data:using-cache'));
        } else {
            console.warn('[数据管理] 本地无缓存数据');
        }

        return state;
    };

    // ============================================================
    // 提供全局访问（供其他模块使用）
    // ============================================================
    window.ArkdleDataManager = {
        loadData,
        loadFromCacheOnly,
        getCachedOperators,
        getCachedFuzzyItem,
        getCachedConfigVersion,
        getCachedAppVersion,
        state,
    };

    const cachedData = getCachedOperators();
    const cachedFuzzy = getCachedFuzzyItem();
    if (cachedData) {
        state.operatorsData = cachedData;
        console.log('[数据管理] 页面启动时恢复本地缓存');
    }
    if (cachedFuzzy) {
        state.fuzzyItemData = cachedFuzzy;
    }
})();
