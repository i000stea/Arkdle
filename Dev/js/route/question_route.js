/**
 * Question Route - 粥友出题路由
 *
 * 接管条件：URL 含有 question 或 tiquestion 参数
 */

class QuestionRoute {
    constructor() {
        this.routeController = window.ArkdleRouteController;
    }

    /**
     * 声明接管条件：URL 含有 question 或 tiquestion 参数时接管
     * @param {URLSearchParams} urlParams
     * @returns {boolean}
     */
    static match(urlParams) {
        return urlParams.has('question') || urlParams.has('tiquestion');
    }

    async execute() {
        console.log('[QuestionRoute] 开始执行粥友出题路由');
        console.log('[QuestionRoute] 粥友出题功能待实现');
        return null;
    }
}

// 导出全局访问
window.ArkdleQuestionRoute = QuestionRoute;

if (window.ArkdleRouteModule && typeof window.ArkdleRouteModule.register === 'function') {
    window.ArkdleRouteModule.register(
        window.ArkdleRouteModule.ROUTE_QUESTION,
        QuestionRoute,
        10
    );
}

console.log('[Route] Question Route Module 已加载');
