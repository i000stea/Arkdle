(function () {
    'use strict';

    /**
     * TooltipModel - 浮窗状态容器（MVC-Model）
     *
     * state 字段说明
     * - visible: 浮窗是否可见
     * - type: 浮窗类型 'fuzzy'（橙色模糊分类）| 'approx'（黄色数值近似）| null
     * - x / y: 浮窗定位坐标（鼠标位置）
     * - fuzzyPayload: 橙色浮窗数据 { select, parent, members }
     * - approxPayload: 黄色浮窗数据 { guessVal, targetVal, tolerance, direction }
     */
    class TooltipModel extends EventTarget {
        constructor() {
            super();
            this.state = {
                visible: false,
                type: null,
                x: 0,
                y: 0,
                fuzzyPayload: null,
                approxPayload: null,
            };
        }

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

    window.ArkdleTooltipModel = TooltipModel;
})();
