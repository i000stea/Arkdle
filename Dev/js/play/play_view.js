/**
 * Play View - MVC 中的 View 层
 * 
 * 职责：DOM 操作和显示
 * - 设置输入框内容
 * - 在 guessing-items 中绘制干员数据（通过独立渲染器）
 *
 * 为什么要把“guessing-item 的创建绘制”独立出去？
 * - View 的职责应该是“命令式更新 UI”，而不是承载大量 DOM 拼装细节
 * - 渲染器可以独立演进：列定义抽配置、DOM 复用、列表虚拟化、样式切换等
 * - Controller/Model 不需要知道具体 DOM 结构，降低耦合
 */

class PlayView {
    constructor(root = document) {
        this.root = root;
        // 一次性收集所有需要操作的 DOM 元素
        this.els = {
            inputName: root.getElementById('input-name'),
            guessingItems: root.getElementById('guessing-items'),
            scrollContainer: root.querySelector('.scroll-container'),
            btnConfirm: root.getElementById('btn-confirm'),
            btnRandomSelect: root.getElementById('btn-random-select'),
            btnShowAnswer: root.getElementById('btn-show-answer'),
            attemptsSpan: root.querySelector('#attempts span'),
        };
        this._hintBarEl = null;
    }

    /** 滚动到最新猜测项 */
    scrollGuessingToLatest() {
        const sc = this.els.scrollContainer;
        if (!sc) return;
        const apply = () => {
            sc.scrollTop = sc.scrollHeight;
        };
        requestAnimationFrame(() => {
            requestAnimationFrame(apply);
        });
    }

    /** 设置输入框的值为随机选择的干员名称 */
    setInputName(value) {
        const input = this.els.inputName;
        if (!input) return;
        if (input.value !== value) input.value = value;
    }

    /**
     * 在 guessing-items 中绘制干员数据
     * @param {Object} operatorData - 干员数据对象
     */
    renderOperatorData(operatorData) {
        const container = this.els.guessingItems;
        if (!container) return;
        const renderer = window.ArkdleGuessingItemRenderer;
        if (renderer && typeof renderer.renderPreview === 'function') {
            renderer.renderPreview(container, operatorData);
            this.scrollGuessingToLatest();
            return;
        }
        if (renderer && typeof renderer.render === 'function') {
            renderer.render(container, operatorData, { clear: true });
            this.scrollGuessingToLatest();
            return;
        }
        container.innerHTML = '';
    }

    /**
     * 将当前预览行"固化"为已确认行，并对其执行逐列对比着色动画
     *
     * 流程：
     * 1. 找到预览行（data-role="preview"）
     * 2. 移除 preview 标记，使其成为普通历史行
     * 3. 调用 Renderer.verifyRow 执行逐格延迟着色
     *
     * @param {Object} guessData  - 猜测干员数据
     * @param {Object} targetData - 目标干员数据
     * @returns {HTMLElement|null} 已确认的行元素（用于后续胜利样式）
     */
    confirmGuessRow(guessData, targetData) {
        const container = this.els.guessingItems;
        if (!container) return null;

        const renderer = window.ArkdleGuessingItemRenderer;
        let previewRow = container.querySelector('.guessing-info[data-role="preview"]');
        if (!previewRow) {
            this.renderOperatorData(guessData);
            previewRow = container.querySelector('.guessing-info[data-role="preview"]');
        }
        if (!previewRow) return null;

        previewRow.removeAttribute('data-role');
        previewRow.removeAttribute('data-operator-name');

        this.scrollGuessingToLatest();

        if (renderer && typeof renderer.verifyRow === 'function') {
            const p = renderer.verifyRow(previewRow, guessData, targetData);
            if (p && typeof p.then === 'function') {
                p.then(() => this.scrollGuessingToLatest()).catch(() => { });
            }
        }

        return previewRow;
    }

    /** 清空输入框 */
    clearInput() {
        const input = this.els.inputName;
        if (input) input.value = '';
    }

    /** 清空猜测项容器 */
    clearGuessingItems() {
        const container = this.els.guessingItems;
        if (container) container.innerHTML = '';
    }

    /** 设置猜测控制按钮是否禁用 */
    setGuessControlsDisabled(disabled) {
        const input = this.els.inputName;
        const btnConfirm = this.els.btnConfirm;
        const btnRandomSelect = this.els.btnRandomSelect;
        if (input) input.disabled = !!disabled;
        if (btnConfirm) btnConfirm.disabled = !!disabled;
        if (btnRandomSelect) btnRandomSelect.disabled = !!disabled;
    }

    /** 设置显示答案按钮是否可见 */
    setShowAnswerVisible(visible) {
        const btn = this.els.btnShowAnswer;
        if (!btn) return;
        btn.hidden = !visible;
    }

    /** 更新已用尝试次数显示 */
    updateAttemptsUsed(used) {
        const span = this.els.attemptsSpan;
        if (!span) return;
        span.textContent = String(used || 0);
    }

    /** 确保提示栏元素存在 */
    ensureHintBar() {
        if (this._hintBarEl) return this._hintBarEl;
        const existing = this.root.getElementById('arkdle-hint-bar');
        if (existing) {
            this._hintBarEl = existing;
            return existing;
        }
        const bar = this.root.createElement('div');
        bar.id = 'arkdle-hint-bar';
        bar.className = 'arkdle-question-hint-bar';
        bar.textContent = '';
        const inputSection = this.root.querySelector('.input-section');
        if (inputSection && inputSection.parentNode) {
            inputSection.parentNode.insertBefore(bar, inputSection);
        } else {
            const container = this.root.querySelector('.container');
            if (container) container.insertBefore(bar, container.firstChild);
        }
        this._hintBarEl = bar;
        return bar;
    }

    /** 设置提示文本 */
    setHint(text, visible) {
        const bar = this.ensureHintBar();
        if (!bar) return;
        bar.textContent = text || '';
        bar.classList.toggle('visible', !!visible);
    }

    /**
     * 在指定行上添加胜利样式
     * @param {HTMLElement} row
     */
    markVictoryRow(row) {
        if (row) row.classList.add('guessing-info--victory');
    }
}

// 导出全局访问
window.ArkdlePlayView = PlayView;
