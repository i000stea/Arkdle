/**
 * Play Model - MVC 中的 Model 层
 * 
 * 职责：管理游戏状态
 * - 当前随机选择的干员数据（用于“随机选择”功能）
 *
 * 设计说明（为什么这样做）
 * - Model 只存“状态”，不直接操作 DOM，也不依赖具体 View
 * - 通过 EventTarget 派发 change 事件，Controller 订阅后更新 View
 * - patch() 只做浅合并 + changedKeys 对比，避免无效刷新
 *
 * state 字段含义
 * - randomOperator: 从 window.operatorsData 中抽出的完整干员数据对象
 * - randomOperatorName: 对应的干员名称（键名），用于快速回填输入框
 */

class PlayModel extends EventTarget {
    constructor() {
        super();
        this.state = {
            randomOperator: null,    // 随机选择的干员数据
            randomOperatorName: '',  // 随机选择的干员名称
            targetOperator: null,    // 本局目标干员数据（用于 verify 对比）
            targetOperatorName: '',  // 本局目标干员名称
            guessHistory: [],        // 已确认的猜测记录 [{ name, data }]
            gameOver: false,         // 本局是否已结束（猜中 / 次数耗尽）
            isVictory: false,        // 是否猜中正确答案
            maxAttempts: 8,
            allowGuessAfterAttemptsExhausted: true,
            allowRevealAnswerAfterAttemptsExhausted: true,
            hintRevealAfterAttempt: null,
            attemptsExhausted: false,
            hintShown: false,
        };
    }

    /** 获取今日日期字符串 */
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

    /** 获取每日猜测缓存键 */
    getDailyGuessCacheKey() {
        return 'arkdle_refactor_daily_guess_cache';
    }

    /** 加载每日猜测进度 */
    loadDailyGuessProgress(targetName) {
        const expectedTargetName = String(targetName || '').trim();
        if (!expectedTargetName) return null;

        try {
            const raw = localStorage.getItem(this.getDailyGuessCacheKey());
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || typeof obj !== 'object') return null;

            const today = this.getTodayStr();
            if (obj.date !== today) return null;
            if (obj.mode !== 'Daily') return null;
            if (String(obj.targetName || '').trim() !== expectedTargetName) return null;

            const names = Array.isArray(obj.guessNames) ? obj.guessNames : null;
            if (!names) return null;
            return names
                .map((n) => String(n || '').trim())
                .filter(Boolean);
        } catch (e) {
            return null;
        }
    }

    /** 保存每日猜测进度 */
    saveDailyGuessProgress() {
        const targetName = String(this.state.targetOperatorName || '').trim();
        if (!targetName) return;

        const guessNames = Array.isArray(this.state.guessHistory)
            ? this.state.guessHistory
                .map((row) => String(row?.data?.name || row?.name || '').trim())
                .filter(Boolean)
            : [];

        const payload = {
            v: 1,
            mode: 'Daily',
            date: this.getTodayStr(),
            targetName,
            guessNames,
            gameOver: !!this.state.gameOver,
            isVictory: !!this.state.isVictory,
            attemptsExhausted: !!this.state.attemptsExhausted,
            hintShown: !!this.state.hintShown,
        };

        try {
            localStorage.setItem(this.getDailyGuessCacheKey(), JSON.stringify(payload));
        } catch (e) { }
    }

    /**
     * 更新状态
     * @param {Partial<PlayModel['state']>} nextPartialState
     *
     * 事件协议
     * - 触发事件：'change'
     * - detail: { changedKeys: string[], state: PlayModel['state'] }
     */
    patch(nextPartialState) {
        const next = { ...this.state, ...nextPartialState };
        const changedKeys = Object.keys(nextPartialState)
            .filter((k) => next[k] !== this.state[k]);
        if (changedKeys.length === 0) return;
        this.state = next;
        this.dispatchEvent(new CustomEvent('change', {
            detail: { changedKeys, state: this.state }
        }));
    }
}

// 导出全局访问
window.ArkdlePlayModel = PlayModel;
