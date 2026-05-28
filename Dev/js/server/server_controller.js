/**
 * Server Controller - 服务器数据查询控制器
 *
 * 职责：提供今日干员查询接口，由调用方按需触发
 * - 不在初始化时主动请求服务器
 * - 缓存策略由 DailyRoute 管理
 * - 提供获取今日干员的方法供外部调用
 */

class ServerController {
    constructor() {
        // 服务器模块引用（由 server.js 初始化并挂载到 window.ArkdleServer）
        this.server = window.ArkdleServer;
        // 今日干员缓存：fetchTodayOperator 成功后由 setTodayOperator 写入
        this.todayOperator = null;
        // 今日日期缓存：与 todayOperator 配对，避免重复计算
        this.todayDate = '';
    }

    /**
     * 获取今日干员（由调用方决定是否发起请求）
     * 不再在初始化时自动调用
     *
     * 执行流程：
     * 1. 若 server 模块可用，调用其 fetchTodayOperator() 方法
     * 2. 若 server 不可用，返回失败结果并附带当前日期（通过 getTodayDate() 计算）
     *
     * @returns {Promise<{success: boolean, operator: string|null, date: string, error?: string}>}
     */
    async fetchTodayOperator() {
        if (this.server && typeof this.server.fetchTodayOperator === 'function') {
            return await this.server.fetchTodayOperator();
        }
        return { success: false, operator: null, date: this.getTodayDate(), error: 'Server module not available' };
    }

    /**
     * 获取当前日期（Asia/Shanghai 时区）
     *
     * 优先使用 toLocaleString + timeZone 参数获取上海时区日期
     * 降级方案：手动拼接年月日，避免时区转换失败导致异常
     *
     * @returns {string} YYYY-MM-DD 格式日期字符串
     */
    getTodayDate() {
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

    /**
     * 获取今日干员（从缓存）
     *
     * 返回 setTodayOperator() 之前缓存的干员名称
     * 若未缓存则返回 null
     *
     * @returns {string|null} 今日干员名称
     */
    getTodayOperator() {
        return this.todayOperator;
    }

    /**
     * 设置今日干员和日期缓存
     *
     * 用于接收 fetchTodayOperator 的结果并写入本地缓存
     * 供 getTodayOperator() 和 getTodayDate() 读取
     *
     * @param {string} operator - 干员名称
     * @param {string} date - 日期字符串 (YYYY-MM-DD)
     */
    setTodayOperator(operator, date) {
        this.todayOperator = operator;
        this.todayDate = date;
    }
}

window.ArkdleServerController = ServerController;

function initServerController() {
    const controller = new ServerController();
    window.ArkdleServerController = controller;

    console.log('[Server] Server Controller 初始化完成（不主动请求服务器）');
}

window.initServerController = initServerController;
