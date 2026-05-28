(function () {
    'use strict';

    /**
     * FuzzySearchModel - 建议列表的状态容器（MVC-Model）
     *
     * 设计要点
     * - state 是唯一真相来源（Single Source of Truth）
     * - patch() 进行浅合并，并计算 changedKeys，减少无意义的 View 刷新
     * - 通过 EventTarget 的 'change' 事件通知 Controller/View
     *
     * state 字段说明
     * - ready: operatorsData 是否已就绪（数据未加载前不展示建议，避免误导）
     * - query: 输入框当前查询串（trim 后）
     * - suggestions: 建议列表（字符串数组，干员中文名）
     * - selectedIndex: 键盘上下选择的高亮索引（-1 表示未选择）
     * - visible: 是否显示建议容器
     */
    class FuzzySearchModel extends EventTarget {
        constructor() {
            super();
            this.state = {
                ready: false,
                query: '',
                suggestions: [],
                selectedIndex: -1,
                visible: false,
            };
        }

        /**
         * 更新部分状态并派发 change
         * @param {Partial<FuzzySearchModel['state']>} nextPartialState
         * 事件协议：
         * - type: 'change'
         * - detail: { changedKeys: string[], state: this.state }
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

    window.ArkdleFuzzySearchModel = FuzzySearchModel;
})();
