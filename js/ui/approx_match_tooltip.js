/**
 * 数值列 oper-approximate 命中时，鼠标悬停或点击显示说明浮层
 */
(function initApproxMatchTooltip() {
    const OFFSET_X = 14;
    const OFFSET_Y = 14;

    function hideOtherTips() {
        const fuzzy = document.getElementById('fuzzy-match-tooltip');
        if (fuzzy) fuzzy.classList.remove('fuzzy-match-tooltip--visible');
    }

    function ensureTooltipEl() {
        let el = document.getElementById('approx-match-tooltip');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'approx-match-tooltip';
        el.setAttribute('role', 'tooltip');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
        return el;
    }

    function fillTipContent(tip, cell) {
        const tolerance = String(cell.getAttribute('data-approx-tolerance') ?? '0');

        tip.replaceChildren();

        const intro = document.createElement('p');
        intro.className = 'approx-match-tooltip-intro';
        intro.append('当前数值近似，相差值在');
        const tolEl = document.createElement('strong');
        tolEl.className = 'approx-match-tooltip-em';
        tolEl.textContent = tolerance;
        intro.append(tolEl, '以内。');

        tip.appendChild(intro);
    }

    function positionTip(tip, clientX, clientY) {
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = tip.getBoundingClientRect();
        let x = clientX + OFFSET_X;
        let y = clientY + OFFSET_Y;
        if (x + rect.width > vw - pad) x = Math.max(pad, clientX - rect.width - OFFSET_X);
        if (y + rect.height > vh - pad) y = Math.max(pad, clientY - rect.height - OFFSET_Y);
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
    }

    function showTip(tip, cell, clientX, clientY) {
        hideOtherTips();
        fillTipContent(tip, cell);
        tip.classList.add('approx-match-tooltip--visible');
        positionTip(tip, clientX, clientY);
    }

    function hideTip(tip) {
        tip.classList.remove('approx-match-tooltip--visible');
    }

    function bind() {
        const root = document.getElementById('guessing-items');
        if (!root || root.dataset.approxTooltipBound === '1') return;
        root.dataset.approxTooltipBound = '1';

        const tip = ensureTooltipEl();
        let activeCell = null;

        function pickCell(target) {
            return target && target.closest && target.closest('.oper-item.oper-approximate[data-approx-detail="1"]');
        }

        root.addEventListener(
            'mouseover',
            (e) => {
                const cell = pickCell(e.target);
                if (!cell || !root.contains(cell)) return;
                activeCell = cell;
                showTip(tip, cell, e.clientX, e.clientY);
            },
            true
        );

        root.addEventListener(
            'mousemove',
            (e) => {
                if (!activeCell || !tip.classList.contains('approx-match-tooltip--visible')) return;
                const cell = pickCell(e.target);
                if (cell && root.contains(cell)) {
                    activeCell = cell;
                    showTip(tip, cell, e.clientX, e.clientY);
                } else {
                    positionTip(tip, e.clientX, e.clientY);
                }
            },
            true
        );

        root.addEventListener(
            'click',
            (e) => {
                const cell = pickCell(e.target);
                if (!cell || !root.contains(cell)) return;
                activeCell = cell;
                showTip(tip, cell, e.clientX, e.clientY);
            },
            true
        );

        root.addEventListener(
            'mouseleave',
            () => {
                activeCell = null;
                hideTip(tip);
            },
            true
        );

        const scrollRoot = root.closest('.scroll-container');
        if (scrollRoot) {
            scrollRoot.addEventListener('scroll', () => hideTip(tip), { passive: true });
        }
        window.addEventListener('blur', () => hideTip(tip));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
