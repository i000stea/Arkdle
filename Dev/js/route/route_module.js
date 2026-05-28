/**
 * Route Module - 路由注册与常量模块
 *
 * 职责：
 * - 定义路由类型常量
 * - 维护路由注册表（registry）
 * - 各路由模块通过 register() 注册自身，RouteController 通过 resolve() 选出匹配路由
 */

(() => {
    'use strict';

    const ROUTE_DAILY = 'daily';
    const ROUTE_RANDOM = 'random';
    const ROUTE_QUESTION = 'question';

    /**
     * 路由注册表
     * 每条记录：{ routeType: string, handlerClass: class, priority: number }
     * priority 越小越优先（类似 CSS z-index 越大越靠前的反向约定，这里数字越小越先匹配）
     */
    const _registry = [];

    /**
     * 注册一个路由处理类
     * @param {string} routeType - 路由类型常量（ROUTE_DAILY / ROUTE_RANDOM / ROUTE_QUESTION）
     * @param {class} handlerClass - 路由处理类，必须实现 static match(urlParams) 和 execute(options)
     * @param {number} [priority=100] - 匹配优先级，数字越小越优先
     */
    const register = (routeType, handlerClass, priority = 100) => {
        if (typeof handlerClass.match !== 'function') {
            console.warn(`[RouteModule] 注册路由 ${routeType} 失败：handlerClass 缺少 static match() 方法`);
            return;
        }
        _registry.push({ routeType, handlerClass, priority });
        _registry.sort((a, b) => a.priority - b.priority);
        console.log(`[RouteModule] 路由已注册: ${routeType} (priority=${priority})`);
    };

    /**
     * 根据 URL 参数解析出匹配的路由类型
     * 遍历注册表，调用每个路由的 static match(urlParams)，返回第一个匹配的 routeType
     * @param {URLSearchParams} urlParams - 当前页面的 URL 参数
     * @returns {string} 匹配到的路由类型，未匹配时返回 ROUTE_DAILY（兜底）
     */
    const resolve = (urlParams) => {
        for (const entry of _registry) {
            if (entry.handlerClass.match(urlParams)) {
                return entry.routeType;
            }
        }
        return ROUTE_DAILY;
    };

    /**
     * 获取注册表快照（只读）
     */
    const getRegistry = () => _registry.slice();

    window.ArkdleRouteModule = {
        ROUTE_DAILY,
        ROUTE_RANDOM,
        ROUTE_QUESTION,
        register,
        resolve,
        getRegistry,
    };

    console.log('[Route] Route Module 已加载');
})();
