/**
 * Server Module - 负责向服务器查询数据
 *
 * 职责：封装服务器 API 请求
 * - 查询今日干员名称（today operator name）
 * - 只做网络请求，不做缓存判断（缓存策略由调用方决定）
 *
 * 依赖
 * - 无外部依赖，使用原生 fetch API
 * - 服务器端点：api/server.php
 */

(() => {
    'use strict';

    const SERVER_URL = 'https://arkdle.milletea.top/api/server.php';

    /**
     * 从服务器请求今日干员名称
     * @returns {Promise<{ success: boolean, operator: string|null, date: string, error?: string }>}
     */
    const fetchTodayOperator = async () => {
        try {
            const response = await fetch(SERVER_URL, {
                method: 'GET',
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('[Server] 服务器响应:', result);

            const data = result?.data;
            const operator = data?.todayOperatorName || null;
            const date = data?.todayDate || new Date().toISOString().slice(0, 10);

            if (operator) {
                return { success: true, operator, date };
            }

            return { success: false, operator: null, date, error: '服务器未返回今日干员名称' };
        } catch (error) {
            console.error('[Server] 查询今日干员失败:', error);
            return {
                success: false,
                operator: null,
                date: new Date().toISOString().slice(0, 10),
                error: error.message,
            };
        }
    };

    /**
     * 获取今日日期（UTC）
     * @returns {string} YYYY-MM-DD 格式
     */
    const getTodayDate = () => {
        return new Date().toISOString().slice(0, 10);
    };

    const onDataLoaded = (operatorName, todayDate) => {
        window.dispatchEvent(new CustomEvent('arkdle:server:today-loaded', {
            detail: { operatorName, todayDate }
        }));
    };

    const onDataError = (error) => {
        window.dispatchEvent(new CustomEvent('arkdle:server:today-error', {
            detail: { error }
        }));
    };

    const onRouteSelected = (route) => {
        window.dispatchEvent(new CustomEvent('arkdle:server:route-selected', {
            detail: { route }
        }));
    };

    window.ArkdleServer = {
        fetchTodayOperator,
        getTodayDate,
        onDataLoaded,
        onDataError,
        onRouteSelected,
    };

    console.log('[Server] Server Module 已加载');
})();
