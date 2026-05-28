/**
 * Daily Route - 每日题目路由
 *
 * 接管条件：兜底路由，任何未被其他路由匹配的情况均由此接管
 *
 * 获取今日干员的策略：
 * 1. 读取本地缓存 { date, operator }
 * 2. 若缓存存在且 date === 今日（Asia/Shanghai），直接使用缓存中的干员
 * 3. 否则请求云端，将返回的 { date, operator } 写入缓存后使用
 */

class DailyRoute {
    constructor() {
        this.server = window.ArkdleServer;
        this.playController = window.ArkdlePlayController;
        this.routeController = window.ArkdleRouteController;
    }

    static match(urlParams) {
        return false;
    }

    getTodayStr() {
        try {
            return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10);
        } catch (e) {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }

    getDailyCacheKey() {
        return 'arkdle_daily_operator_cache';
    }

    readDailyOperatorCache() {
        try {
            const raw = localStorage.getItem(this.getDailyCacheKey());
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || typeof obj.date !== 'string' || typeof obj.operator !== 'string') return null;
            return obj;
        } catch (e) {
            return null;
        }
    }

    writeDailyOperatorCache(date, operator) {
        try {
            localStorage.setItem(this.getDailyCacheKey(), JSON.stringify({ date, operator }));
        } catch (e) { }
    }

    /**
     * 获取今日干员名称
     * - 缓存命中（date === 今日）→ 直接返回缓存中的 operator
     * - 缓存未命中 → 请求云端，写入缓存后返回
     * @returns {Promise<string|null>}
     */
    async resolveTodayOperator() {
        const today = this.getTodayStr();

        const cache = this.readDailyOperatorCache();
        if (cache && cache.date === today && cache.operator) {
            console.log('[DailyRoute] 使用今日缓存干员:', cache.operator);
            return cache.operator;
        }

        console.log('[DailyRoute] 缓存未命中，请求云端');
        const result = await this.server.fetchTodayOperator();
        if (!result.success || !result.operator) {
            console.warn('[DailyRoute] 云端请求失败:', result.error);
            return null;
        }

        this.writeDailyOperatorCache(today, result.operator);
        console.log('[DailyRoute] 云端返回并写入缓存:', result.operator);
        return result.operator;
    }

    dispatchTargetToPlayController({ operatorName, operatorData }) {
        const playController = window.ArkdlePlayController || this.playController;
        if (!playController || typeof playController.handleTargetOperator !== 'function') return;

        const setDailyPersistSuppressed = typeof playController.setDailyPersistSuppressed === 'function'
            ? playController.setDailyPersistSuppressed.bind(playController)
            : null;
        const restoreDailyGuessProgress = typeof playController.restoreDailyGuessProgress === 'function'
            ? playController.restoreDailyGuessProgress.bind(playController)
            : null;

        if (setDailyPersistSuppressed) setDailyPersistSuppressed(true);
        try {
            playController.handleTargetOperator(operatorName, operatorData);
        } finally {
            if (setDailyPersistSuppressed) setDailyPersistSuppressed(false);
        }

        if (restoreDailyGuessProgress) restoreDailyGuessProgress(operatorName);
    }

    async execute(options = null) {
        console.log('[DailyRoute] 开始执行每日题目路由');

        try {
            const operatorName = await this.resolveTodayOperator();

            if (!operatorName) {
                console.warn('[DailyRoute] 获取每日干员失败');
                if (this.server && typeof this.server.onDataError === 'function') {
                    this.server.onDataError('无法获取每日干员');
                }
                return null;
            }

            console.log('[DailyRoute] 获取到每日干员:', operatorName);

            const operatorsData = window.operatorsData;
            if (!operatorsData || !operatorsData[operatorName]) {
                console.warn('[DailyRoute] 干员数据中未找到:', operatorName);
                return null;
            }

            const operatorData = operatorsData[operatorName];

            this.dispatchTargetToPlayController({ operatorName, operatorData });

            window.todayOperatorName = operatorName;
            window.arkdleTodayOperator = operatorName;
            window.arkdleTodayDate = this.getTodayStr();

            console.log('[DailyRoute] 每日题目路由执行完成');
            return operatorName;
        } catch (error) {
            console.error('[DailyRoute] 执行失败:', error);
            if (this.server && typeof this.server.onDataError === 'function') {
                this.server.onDataError(error.message);
            }
            return null;
        }
    }
}

window.ArkdleDailyRoute = DailyRoute;

if (window.ArkdleRouteModule && typeof window.ArkdleRouteModule.register === 'function') {
    window.ArkdleRouteModule.register(
        window.ArkdleRouteModule.ROUTE_DAILY,
        DailyRoute,
        100
    );
}

console.log('[Route] Daily Route Module 已加载');
