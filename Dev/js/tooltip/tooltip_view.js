(function () {
    'use strict';

    /**
     * TooltipView - 浮窗 DOM 视图层（MVC-View）
     *
     * 职责
     * - 管理 #fuzzy-match-tooltip 和 #approx-match-tooltip 两个浮窗 DOM
     * - 若 DOM 不存在则自动创建并挂载到 body
     * - 只负责渲染和定位，不含任何业务逻辑
     *
     * 浮窗跟随鼠标：由 Controller 在 mousemove 时调用 move(x, y)
     */
    class TooltipView {
        constructor() {
            this._fuzzyEl = this._ensureFuzzyEl();
            this._approxEl = this._ensureApproxEl();
        }

        _ensureFuzzyEl() {
            let el = document.getElementById('fuzzy-match-tooltip');
            if (!el) {
                el = document.createElement('div');
                el.id = 'fuzzy-match-tooltip';
                el.setAttribute('role', 'tooltip');
                el.setAttribute('aria-live', 'polite');
                document.body.appendChild(el);
            }
            return el;
        }

        _ensureApproxEl() {
            let el = document.getElementById('approx-match-tooltip');
            if (!el) {
                el = document.createElement('div');
                el.id = 'approx-match-tooltip';
                document.body.appendChild(el);
            }
            return el;
        }

        /**
         * 显示橙色模糊分类浮窗
         * @param {{ select: string, parent: string, members: string[] }} payload
         * @param {number} x
         * @param {number} y
         */
        showFuzzy(payload, x, y) {
            this._hideAll();
            const el = this._fuzzyEl;

            const membersHtml = (payload.members || [])
                .map((m) => m === payload.select 
                    ? `<li><strong class="fuzzy-match-tooltip-select">${m}</strong></li>` 
                    : `<li>${m}</li>`)
                .join('');

            el.innerHTML =
                `<p class="fuzzy-match-tooltip-intro">` +
                `模糊命中，当前选择<strong class="fuzzy-match-tooltip-select">${payload.select}</strong>属于${payload.parent}。</p>` +
                `<p class="fuzzy-match-tooltip-label">包括：</p>` +
                `<ul class="fuzzy-match-tooltip-list">${membersHtml}</ul>`;

            this._position(el, x, y);
            el.classList.add('fuzzy-match-tooltip--visible');
        }

        /**
         * 显示黄色数值近似浮窗
         * @param {{ guessVal: number|string, targetVal: number|string, tolerance: number, direction: 'more'|'less'|'equal' }} payload
         * @param {number} x
         * @param {number} y
         */
        showApprox(payload, x, y) {
            this._hideAll();
            const el = this._approxEl;

            const dirText = payload.direction === 'more' ? '偏高' : payload.direction === 'less' ? '偏低' : '接近';
            el.innerHTML =
                `<p class="approx-match-tooltip-intro">` +
                `数值 <span class="approx-match-tooltip-em">${payload.guessVal}</span>` +
                ` 与目标干员数值相差在 ${payload.tolerance} 以内` +
                `</p>`;

            this._position(el, x, y);
            el.classList.add('approx-match-tooltip--visible');
        }

        /** 隐藏所有浮窗 */
        hideAll() {
            this._hideAll();
        }

        _hideAll() {
            this._fuzzyEl.classList.remove('fuzzy-match-tooltip--visible');
            this._approxEl.classList.remove('approx-match-tooltip--visible');
        }

        /**
         * 更新浮窗位置（跟随鼠标）
         * 自动处理视口边界，避免浮窗超出屏幕
         */
        move(x, y) {
            const visibleFuzzy = this._fuzzyEl.classList.contains('fuzzy-match-tooltip--visible');
            const visibleApprox = this._approxEl.classList.contains('approx-match-tooltip--visible');
            if (visibleFuzzy) this._position(this._fuzzyEl, x, y);
            if (visibleApprox) this._position(this._approxEl, x, y);
        }

        _position(el, x, y) {
            const offset = 14;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const rect = el.getBoundingClientRect();
            const w = rect.width || 300;
            const h = rect.height || 80;

            let left = x + offset;
            let top = y + offset;

            if (left + w > vw - 8) left = x - w - offset;
            if (top + h > vh - 8) top = y - h - offset;
            if (left < 8) left = 8;
            if (top < 8) top = 8;

            el.style.transform = `translate(${left}px, ${top}px)`;
        }
    }

    window.ArkdleTooltipView = TooltipView;
})();
