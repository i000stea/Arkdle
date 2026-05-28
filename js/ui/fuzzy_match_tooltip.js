/**
 * 势力 / 出身地 / 种族 在 oper-fuzzy 命中时，鼠标悬停或点击显示说明浮层
 */
(function initFuzzyMatchTooltip() {
    const OFFSET_X = 14;
    const OFFSET_Y = 14;

    function ensureTooltipEl() {
        let el = document.getElementById('fuzzy-match-tooltip');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'fuzzy-match-tooltip';
        el.setAttribute('role', 'tooltip');
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
        return el;
    }

    function fillTipContent(tip, cell) {
        const select = (cell.textContent || '').trim()
            || String(cell.getAttribute('data-fuzzy-select') ?? '');
        const parent = String(cell.getAttribute('data-fuzzy-parent') ?? '');
        let members = [];
        try {
            members = JSON.parse(cell.getAttribute('data-fuzzy-members') || '[]');
        } catch (e) {
            members = [];
        }
        if (!Array.isArray(members)) members = [];

        tip.replaceChildren();

        const intro = document.createElement('p');
        intro.className = 'fuzzy-match-tooltip-intro';
        intro.append('模糊命中，当前选择');
        const selectEl = document.createElement('strong');
        selectEl.className = 'fuzzy-match-tooltip-select';
        selectEl.textContent = select;
        intro.append(selectEl, `属于${parent}。`);

        const label = document.createElement('p');
        label.className = 'fuzzy-match-tooltip-label';
        label.textContent = '包括：';

        const ul = document.createElement('ul');
        ul.className = 'fuzzy-match-tooltip-list';
        members.forEach((m) => {
            const li = document.createElement('li');
            const name = String(m);
            if (name === select) {
                const strong = document.createElement('strong');
                strong.className = 'fuzzy-match-tooltip-select';
                strong.textContent = name;
                li.appendChild(strong);
            } else {
                li.textContent = name;
            }
            ul.appendChild(li);
        });

        tip.appendChild(intro);
        tip.appendChild(label);
        tip.appendChild(ul);
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

    function hideOtherTips() {
        const approx = document.getElementById('approx-match-tooltip');
        if (approx) approx.classList.remove('approx-match-tooltip--visible');
    }

    function showTip(tip, cell, clientX, clientY) {
        hideOtherTips();
        fillTipContent(tip, cell);
        tip.classList.add('fuzzy-match-tooltip--visible');
        positionTip(tip, clientX, clientY);
    }

    function hideTip(tip) {
        tip.classList.remove('fuzzy-match-tooltip--visible');
    }

    function bind() {
        const root = document.getElementById('guessing-items');
        if (!root || root.dataset.fuzzyTooltipBound === '1') return;
        root.dataset.fuzzyTooltipBound = '1';

        const tip = ensureTooltipEl();
        let activeCell = null;

        function pickCell(target) {
            return target && target.closest && target.closest('.oper-item.oper-fuzzy[data-fuzzy-detail="1"]');
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
                if (!activeCell || !tip.classList.contains('fuzzy-match-tooltip--visible')) return;
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
