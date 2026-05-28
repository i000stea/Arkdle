(function () {
    'use strict';

    /**
     * TooltipController - 浮窗控制器（MVC-Controller）
     *
     * 职责
     * - 订阅 Model 变化，驱动 View 渲染/隐藏/定位
     * - 监听全局 mousemove，实时更新浮窗跟随鼠标位置
     * - 对外暴露 showFuzzy / showApprox / hide 三个命令式接口
     *   供 fuzzy_search_controller 调用
     *
     * 设计说明
     * - TooltipController 不感知"干员数据"，只接收已计算好的 payload
     * - 黄色/橙色的判断逻辑在 fuzzy_search_controller 中完成
     */
    class TooltipController {
        constructor(model, view) {
            this.model = model;
            this.view = view;
            this._bound = false;
            this._mouseMoveHandler = null;
        }

        init() {
            if (this._bound) return;
            this._bound = true;

            this.model.addEventListener('change', (evt) => {
                const state = evt.detail?.state;
                if (!state) return;

                if (!state.visible) {
                    this.view.hideAll();
                    return;
                }

                if (state.type === 'fuzzy' && state.fuzzyPayload) {
                    this.view.showFuzzy(state.fuzzyPayload, state.x, state.y);
                } else if (state.type === 'approx' && state.approxPayload) {
                    this.view.showApprox(state.approxPayload, state.x, state.y);
                }
            });

            this._mouseMoveHandler = (evt) => {
                if (!this.model.state.visible) return;
                this.view.move(evt.clientX, evt.clientY);
            };
            document.addEventListener('mousemove', this._mouseMoveHandler, { passive: true });
        }

        /**
         * 显示橙色模糊分类浮窗
         * @param {{ select: string, parent: string, members: string[] }} payload
         * @param {number} x
         * @param {number} y
         */
        showFuzzy(payload, x, y) {
            this.model.patch({
                visible: true,
                type: 'fuzzy',
                x,
                y,
                fuzzyPayload: payload,
                approxPayload: null,
            });
        }

        /**
         * 显示黄色数值近似浮窗
         * @param {{ guessVal, targetVal, tolerance, direction }} payload
         * @param {number} x
         * @param {number} y
         */
        showApprox(payload, x, y) {
            this.model.patch({
                visible: true,
                type: 'approx',
                x,
                y,
                fuzzyPayload: null,
                approxPayload: payload,
            });
        }

        hide() {
            this.model.patch({ visible: false, type: null });
        }
    }

    function initTooltip() {
        const Model = window.ArkdleTooltipModel;
        const View = window.ArkdleTooltipView;
        if (!Model || !View) return;

        const model = new Model();
        const view = new View();
        const controller = new TooltipController(model, view);
        controller.init();

        window.ArkdleTooltip = controller;
    }

    window.initTooltip = initTooltip;
})();
