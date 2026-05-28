(function () {
    'use strict';

    /**
     * FuzzySearchController - 模糊搜索建议的控制器（MVC-Controller）
     *
     * 迁移来源
     * - 旧版 operator_name_fuzzy_search.js 中：
     *   - handleInputUpdate(): 输入变化 -> 搜索 -> 渲染建议
     *   - handleKeyDown(): 上下选择 + 空格确认
     *   - click outside: 点击外部隐藏建议
     *
     * 重构后的职责
     * - 监听输入/键盘/点击外部等 UI 事件
     * - 调用 Engine 产出 suggestions
     * - 更新 Model（驱动 View 渲染）
     *
     * 依赖
     * - window.operatorsData：数据源（由 Refactor 的 DataManager + App 启动流程挂到 window）
     * - window.ArkdleFuzzySearchEngine：纯算法层
     */
    class FuzzySearchController {
        constructor(model, view, engine) {
            this.model = model;
            this.view = view;
            this.engine = engine;
            this._bound = false;
            this._outsideClickHandler = null;
            this._containerClickHandler = null;
        }

        /**
         * 初始化控制器（只允许执行一次）
         * - 订阅 Model 变化：visible=false -> hide；visible=true -> renderSuggestions
         * - 绑定数据就绪、输入、键盘、点击外部等事件
         */
        init() {
            if (this._bound) return;
            this._bound = true;

            this.model.addEventListener('change', (evt) => {
                const state = evt.detail?.state;
                if (!state) return;
                if (!state.visible) {
                    this.view.hide();
                    return;
                }
                this.view.renderSuggestions(state.suggestions, state.selectedIndex);
            });

            this.bindDataReady();
            this.bindInput();
            this.bindKeyboard();
            this.bindSuggestionClick();
            this.bindOutsideClick();
        }

        /**
         * 监听数据是否就绪
         * - operatorsData 由启动流程异步加载：未加载前不展示建议（ready=false）
         * - 订阅 arkdle:data:loaded / arkdle:data:using-cache，避免用户需要刷新才能生效
         */
        bindDataReady() {
            const syncReady = () => {
                const ready = !!(window.operatorsData && Object.keys(window.operatorsData).length > 0);
                this.model.patch({ ready });
            };

            syncReady();

            window.addEventListener('arkdle:data:loaded', syncReady);
            window.addEventListener('arkdle:data:using-cache', syncReady);
        }

        /**
         * 输入监听
         * - input: 输入变化立即更新 query 并触发搜索
         * - focus: 输入框重新获得焦点时，如果已有 query，则刷新一次建议（避免“回来后没提示”）
         */
        bindInput() {
            const input = this.view.els.input;
            if (!input) return;
            input.addEventListener('input', () => {
                this.onQueryChanged(input.value);
            });
            input.addEventListener('focus', () => {
                if (this.model.state.query) {
                    this.onQueryChanged(input.value);
                }
            });
        }

        /**
         * 键盘交互（绑定在 input 上）
         * - ArrowUp/ArrowDown：循环选择
         * - Enter / Space：确认当前选中项并回填输入框
         *
         * 说明：旧版使用 document 级别 keydown，这里收敛到 input，减少全局副作用
         */
        bindKeyboard() {
            const input = this.view.els.input;
            if (!input) return;
            input.addEventListener('keydown', (evt) => {
                if (!this.model.state.visible) return;
                const total = this.model.state.suggestions.length;
                if (!total) return;

                if (evt.key === 'ArrowDown') {
                    evt.preventDefault();
                    const next = (this.model.state.selectedIndex + 1) % total;
                    this.model.patch({ selectedIndex: next });
                    return;
                }
                if (evt.key === 'ArrowUp') {
                    evt.preventDefault();
                    const next = (this.model.state.selectedIndex - 1 + total) % total;
                    this.model.patch({ selectedIndex: next });
                    return;
                }
                if (evt.key === 'Enter') {
                    if (this.model.state.selectedIndex < 0) return;
                    evt.preventDefault();
                    const selectedName = this.model.state.suggestions[this.model.state.selectedIndex] || '';
                    this.applySuggestionByIndex(this.model.state.selectedIndex);
                    this.triggerPreview(selectedName);
                    return;
                }
                if (evt.code === 'Space' || evt.key === ' ') {
                    if (this.model.state.selectedIndex < 0) return;
                    evt.preventDefault();
                    this.applySuggestionByIndex(this.model.state.selectedIndex);
                }
            });
        }

        /**
         * 点击 suggestion-item 后：
         * 1) 回填输入框（并触发 input 事件同步 AppModel）
         * 2) 关闭 suggestions-container
         * 3) 触发一次“确认”（等价于点击 btn-confirm）
         */
        bindSuggestionClick() {
            const container = this.view.els.container;
            if (!container) return;
            if (this._containerClickHandler) return;

            this._containerClickHandler = (evt) => {
                const t = evt.target instanceof Element ? evt.target : null;
                if (!t) return;
                const item = t.closest?.('.suggestion-item[data-value]') ?? null;
                if (!item) return;

                evt.preventDefault();
                evt.stopPropagation();

                const value = item.getAttribute('data-value') || '';
                if (!value) return;

                const idxRaw = item.getAttribute('data-index');
                const idx = idxRaw != null ? parseInt(idxRaw, 10) : NaN;
                if (!Number.isNaN(idx)) {
                    this.model.patch({ selectedIndex: idx });
                }

                this.view.applyInputValue(value);
                this.hideSuggestions();
                this.triggerPreview(value);
            };

            container.addEventListener('click', this._containerClickHandler, true);
        }

        /**
         * 点击输入框外隐藏建议列表
         * - 使用 capture=true：即使某些区域 stopPropagation，也能优先捕获关闭逻辑
         * - 通过 container.contains 判定点击是否发生在建议列表内（列表内点击不关闭）
         */
        bindOutsideClick() {
            const input = this.view.els.input;
            const container = this.view.els.container;
            if (!input || !container) return;
            if (this._outsideClickHandler) return;

            this._outsideClickHandler = (evt) => {
                const t = evt.target instanceof Element ? evt.target : null;
                if (!t) return;
                if (t === input) return;
                if (container.contains(t)) return;
                this.hideSuggestions();
            };
            document.addEventListener('click', this._outsideClickHandler, true);
        }

        /** 统一隐藏建议列表（清空数据 + visible=false） */
        hideSuggestions() {
            this.model.patch({
                suggestions: [],
                selectedIndex: -1,
                visible: false,
            });
        }

        /**
         * 查询串变化时的主流程：query -> suggestions -> visible
         * - query 为空：直接隐藏
         * - ready=false：直接隐藏（数据未就绪不做搜索）
         * - 否则：调用 Engine 计算匹配，并限制前 10 条
         */
        onQueryChanged(value) {
            const query = (value || '').trim();
            this.model.patch({ query });

            if (!query) {
                this.hideSuggestions();
                return;
            }

            if (!this.model.state.ready) {
                this.hideSuggestions();
                return;
            }

            const operatorsData = window.operatorsData;
            const matches = this.engine.searchOperators(operatorsData, query);
            const limited = matches.slice(0, 10);
            this.model.patch({
                suggestions: limited,
                selectedIndex: -1,
                visible: limited.length > 0,
            });
        }

        /**
         * 将选中建议回填到输入框，并隐藏建议列表
         * - 回填时会派发 input 事件，确保 AppModel.state.inputName 同步
         */
        applySuggestionByIndex(index) {
            const name = this.model.state.suggestions[index];
            if (!name) return;
            this.view.applyInputValue(name);
            this.hideSuggestions();
        }

        /**
         * 触发一次“确认”行为（等价于点击 btn-confirm）
         * 优先顺序：
         * 1) 若按钮存在：调用 btn.click() 走页面既有事件绑定（最贴近“btn-confirm 对应事件”的语义）
         * 2) 若存在 AppController.onConfirm：直接调用（Refactor 下 Enter 已走这条逻辑）
         * 3) 兜底：派发 arkdle:ui:confirm（与 AppController 的事件协议一致）
         */
        triggerConfirmOnce() {
            const btn = document.getElementById('btn-confirm');
            if (btn && typeof btn.click === 'function') {
                btn.click();
                return;
            }

            const appCtrl = window.ArkdleRefactor?.controller;
            if (appCtrl && typeof appCtrl.onConfirm === 'function') {
                appCtrl.onConfirm();
                return;
            }

            const name = window.ArkdleRefactor?.model?.state?.inputName
                || this.view.els.input?.value
                || '';
            window.dispatchEvent(new CustomEvent('arkdle:ui:confirm', {
                detail: { name }
            }));
        }

        triggerPreview(name) {
            const n = (name || '').trim();
            if (!n) return;
            window.dispatchEvent(new CustomEvent('arkdle:ui:preview', {
                detail: { name: n }
            }));
        }
    }

    /**
     * 模块入口：创建 MVC 三件套并挂到 window
     * - window.ArkdleRefactorFuzzySearch 用于调试/热更新时定位实例
     */
    function initFuzzySearch() {
        const engine = window.ArkdleFuzzySearchEngine;
        const Model = window.ArkdleFuzzySearchModel;
        const View = window.ArkdleFuzzySearchView;
        if (!engine || !Model || !View) return;

        const model = new Model();
        const view = new View(document);
        const controller = new FuzzySearchController(model, view, engine);
        controller.init();

        window.ArkdleRefactorFuzzySearch = { model, view, controller };
    }

    window.initFuzzySearch = initFuzzySearch;
})();

