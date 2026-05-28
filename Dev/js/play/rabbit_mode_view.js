(function () {
    'use strict';

    const STORAGE_KEY = 'arkdle_rabbit_mode_on';

    /** 读取偏好设置 */ 
    function readPreference() {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            if (v === null) return true;
            return v === '1' || v === 'true';
        } catch (_) {
            return true;
        }
    }

    /** 写入偏好设置 */
    function writePreference(enabled) {
        try {
            localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
        } catch (_) {}
    }

    /** 应用切换按钮UI状态 */
    function applyToggleButtonUI(btn, enabled) {
        if (!btn) return;
        btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        btn.classList.toggle('btn-rabbit-toggle--off', !enabled);
    }

    /** 同步兔头模式网格布局 */
    function syncRabbitModeGrid() {
        if (typeof document === 'undefined' || !document.body) return;
        const off = document.body.classList.contains('rabbit-mode-off');
        document.querySelectorAll('.guessing-info').forEach((row) => {
            if (!off) {
                row.classList.remove('guessing-info--compact');
                Array.from(row.children).forEach((cell) => {
                    cell.style.removeProperty('display');
                    cell.style.removeProperty('grid-column');
                });
                return;
            }
            row.classList.add('guessing-info--compact');
            let col = 1;
            Array.from(row.children).forEach((cell) => {
                if (cell.classList.contains('rabbit-stat')) {
                    cell.style.display = 'none';
                    cell.style.removeProperty('grid-column');
                } else {
                    cell.style.display = '';
                    cell.style.gridColumn = String(col++);
                }
            });
        });
    }

    /** 兔头模式视图 */
    class RabbitModeView extends EventTarget {
        constructor(root = document) {
            super();
            this.root = root;
            this.btn = null;
            this._bound = false;
        }

        /** 初始化视图 */
        init() {
            // 兔头模式切换按钮
            this.btn = this.root.getElementById('btn-rabbit-mode');
            if (this.btn && !this._bound) {
                this._bound = true;
                this.btn.addEventListener('click', (evt) => {
                    evt.preventDefault();
                    const curOn = !document.body.classList.contains('rabbit-mode-off');
                    const nextOn = !curOn;
                    this.dispatchEvent(new CustomEvent('toggle', { detail: { enabled: nextOn } }));
                });
            }
        }

        /** 获取偏好设置 */
        getPreferredEnabled() {
            return readPreference();
        }

        /** 设置偏好设置 */
        setEnabled(enabled) {
            writePreference(!!enabled);
            this.apply(!!enabled);
        }

        /** 应用兔头模式状态 */
        apply(enabled) {
            if (!document.body) return;
            document.body.classList.toggle('rabbit-mode-off', !enabled);
            applyToggleButtonUI(this.btn, enabled);
            syncRabbitModeGrid();
        }

        /** 同步兔头模式网格布局 */
        syncGrid() {
            syncRabbitModeGrid();
        }
    }

    window.syncRabbitModeGrid = syncRabbitModeGrid;
    window.ArkdleRabbitModeView = RabbitModeView;
})();
