/**
 * Random Route - 随机题目路由
 *
 * 接管条件：URL 含有 mode=random 或 random 参数
 */

class RandomRoute {
    constructor() {
        this.playController = window.ArkdlePlayController;
        this.routeController = window.ArkdleRouteController;
    }

    /**
     * 声明接管条件：URL 含有 mode=random 或 random 参数时接管
     * @param {URLSearchParams} urlParams
     * @returns {boolean}
     */
    static match(urlParams) {
        const mode = (urlParams.get('mode') || '').trim().toLowerCase();
        return mode === 'random' || urlParams.has('random');
    }

    async execute(options = null) {
        console.log('[RandomRoute] 开始执行随机题目路由');

        try {
            const operatorsData = window.operatorsData;
            if (!operatorsData || Object.keys(operatorsData).length === 0) {
                console.warn('[RandomRoute] 干员数据尚未加载');
                return null;
            }

            const operatorNames = Object.keys(operatorsData);
            const randomIndex = Math.floor(Math.random() * operatorNames.length);
            const randomName = operatorNames[randomIndex];

            if (!randomName || !operatorsData[randomName]) {
                console.warn('[RandomRoute] 未能得到有效的随机干员');
                return null;
            }

            const randomOperator = operatorsData[randomName];

            console.log('[RandomRoute] 随机选择干员:', randomName);

            const playController = this.playController;
            if (playController && typeof playController.handleTargetOperator === 'function') {
                playController.handleTargetOperator(randomName, randomOperator);
            }

            console.log('[RandomRoute] 随机题目路由执行完成');
            return randomName;
        } catch (error) {
            console.error('[RandomRoute] 执行失败:', error);
            return null;
        }
    }
}

window.ArkdleRandomRoute = RandomRoute;

if (window.ArkdleRouteModule && typeof window.ArkdleRouteModule.register === 'function') {
    window.ArkdleRouteModule.register(
        window.ArkdleRouteModule.ROUTE_RANDOM,
        RandomRoute,
        20
    );
}

console.log('[Route] Random Route Module 已加载');
