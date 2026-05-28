(function () {
    'use strict';

    /**
     * FuzzySearchView - 建议列表的 DOM 视图层（MVC-View）
     *
     * 职责边界
     * - 只做 DOM 渲染/显示隐藏/输入框赋值
     * - 不做搜索算法、不做业务决策（这些在 Engine/Controller）
     *
     * 与 AppController 的兼容策略
     * - 每个 suggestion-item 都写入 data-value
     * - AppController.bindSuggestions 会监听 suggestions-container 的 click，
     *   通过 [data-value] 提取值并同步到 AppModel（复用已有逻辑）
     */
    class FuzzySearchView {
        constructor(root = document) {
            this.root = root;
            this.els = {
                input: root.getElementById('input-name'),
                container: root.getElementById('suggestions-container'),
            };
        }

        /** 清空并隐藏建议列表容器 */
        hide() {
            const c = this.els.container;
            if (!c) return;
            c.innerHTML = '';
            c.style.display = 'none';
        }

        /** 显示建议列表容器（不渲染内容） */
        show() {
            const c = this.els.container;
            if (!c) return;
            c.style.display = 'block';
        }

        /**
         * 渲染建议列表（最多由 Controller 限制为 10 条）
         * @param {string[]} names - 建议干员名
         * @param {number} selectedIndex - 当前高亮项索引
         */
        renderSuggestions(names, selectedIndex) {
            const c = this.els.container;
            if (!c) return;
            c.innerHTML = '';

            if (!names || names.length === 0) {
                c.style.display = 'none';
                return;
            }

            for (let i = 0; i < names.length; i++) {
                const operatorName = names[i];
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                if (i === selectedIndex) item.classList.add('selected');
                item.textContent = operatorName;
                item.setAttribute('data-value', operatorName);
                item.setAttribute('data-index', String(i));
                item.addEventListener('mousedown', (evt) => {
                    evt.preventDefault();
                });
                c.appendChild(item);
            }

            c.style.display = 'block';
        }

        /**
         * 命令式设置输入框值，并派发 input 事件让 AppModel 同步
         * - 只改 input.value 不派发事件的话，AppModel.state.inputName 不会更新
         * - 派发 bubbles:true 让上层监听也能收到
         */
        applyInputValue(value) {
            const input = this.els.input;
            if (!input) return;
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    window.ArkdleFuzzySearchView = FuzzySearchView;
})();
