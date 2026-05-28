(function () {
    'use strict';

    /**
     * GuessingItemRenderer - guessing-items 区域「单行」渲染器（Refactor 专用）
     *
     * 设计目标
     * - 将 guessing-items 内部的 DOM 创建与绘制从 View 中剥离，形成单独模块
     * - 便于未来扩展：列增删/列顺序调整/虚拟列表/DOM 复用/性能埋点
     *
     * 与页面结构的约定
     * - 容器：#guessing-items（见 Refactor/index.html）
     * - 每行：.guessing-info（CSS 以 grid 13 列布局）
     * - 每格：.oper-item
     * - 兔头模式数值列：额外带 .rabbit-stat，便于通过 body.rabbit-mode-off 隐藏
     *
     * 对外 API（挂到 window，保持与其他 Refactor 模块一致）
     * - ArkdleGuessingItemRenderer.createRow(operatorData) -> HTMLElement
     * - ArkdleGuessingItemRenderer.render(container, operatorData, { clear?: boolean })
     *
     * 注意
     * - 这里仅负责“绘制一行”，不负责对错比对着色（那是旧版 role_row_component 的职责）
     * - 当前实现默认 render 时清空容器（clear=true），与 PlayView 的“展示随机干员”需求匹配
     */

    const RABBIT_STAT_KEYS = new Set([
        'oper-hp',
        'oper-atk',
        'oper-def',
        'oper-res',
        'oper-reDeploy',
        'oper-cost',
        'oper-block',
    ]);

    const PREVIEW_ROLE = 'preview';

    const COLUMNS = [
        { key: 'oper-name', get: (d) => d?.name },
        { key: 'oper-profession', get: (d) => d?.profession },
        { key: 'oper-hp', get: (d) => d?.hp },
        { key: 'oper-atk', get: (d) => d?.atk },
        { key: 'oper-def', get: (d) => d?.def },
        { key: 'oper-res', get: (d) => d?.res },
        { key: 'oper-reDeploy', get: (d) => d?.reDeploy },
        { key: 'oper-cost', get: (d) => d?.cost },
        { key: 'oper-block', get: (d) => d?.block },
        { key: 'oper-position', get: (d) => d?.position },
        { key: 'oper-Campus', get: (d) => d?.Campus },
        { key: 'oper-Origin', get: (d) => d?.Origin },
        { key: 'oper-Race', get: (d) => d?.Race },
    ];

    /** 将任意值安全转换为文本（避免 null/undefined 直接渲染成字符串） */
    function toText(value) {
        if (value === undefined || value === null) return '';
        return String(value);
    }

    /**
     * 创建一个单元格
     * @param {string} key - 列标识（用于判断是否为 rabbit-stat）
     * @param {any} value - 要渲染的值
     */
    function createCell(key, value) {
        const el = document.createElement('div');
        el.classList.add('oper-item');
        el.setAttribute('data-key', key);
        if (RABBIT_STAT_KEYS.has(key)) {
            el.classList.add('rabbit-stat');
        }
        el.textContent = toText(value);
        return el;
    }

    /**
     * 创建一整行 guessing-info（13 列，与表头一致）
     * operatorData 字段约定来自 resource/data_Operators.json：
     * - name/profession/hp/atk/def/res/reDeploy/cost/block/position/Campus/Origin/Race
     */
    /** 创建一整行 guessing-info（13 列，与表头一致） */
    function createRow(operatorData) {
        const row = document.createElement('div');
        row.className = 'guessing-info';

        // 重要：列顺序必须与 Refactor/index.html 中表头顺序一致，否则会出现“表头与内容错位”
        for (const col of COLUMNS) {
            row.appendChild(createCell(col.key, col.get(operatorData)));
        }

        return row;
    }

    /** 更新行内容 */
    function updateRow(row, operatorData) {
        if (!row) return;
        for (const col of COLUMNS) {
            const cell = row.querySelector(`.oper-item[data-key="${col.key}"]`);
            if (!cell) continue;
            cell.textContent = toText(col.get(operatorData));
        }
    }

    /** 获取预览行（若存在） */
    function getPreviewRow(container) {
        if (!container) return null;
        return container.querySelector(`.guessing-info[data-role="${PREVIEW_ROLE}"]`);
    }

    /** 移除预览行（若存在） */
    function removePreview(container) {
        const row = getPreviewRow(container);
        if (!row) return;
        row.remove();
    }

    /**
     * 预览行渲染：若已存在预览行则尽量复用/更新，避免重复创建 guessing-info
     * - 若预览行存在且 operatorName 相同：不做任何操作（满足“不再重复执行”）
     * - 若预览行存在但 operatorName 不同：更新内容，不新增 DOM
     * - 若预览行不存在：创建并追加一行
     */
    function renderPreview(container, operatorData) {
        if (!container || !operatorData) return;

        const nextName = toText(operatorData.name);
        const previewRow = getPreviewRow(container);

        if (previewRow) {
            const currentName = previewRow.getAttribute('data-operator-name') || '';
            if (currentName === nextName) {
                return;
            }
            updateRow(previewRow, operatorData);
            previewRow.setAttribute('data-operator-name', nextName);
        } else {
            const row = createRow(operatorData);
            row.setAttribute('data-role', PREVIEW_ROLE);
            row.setAttribute('data-operator-name', nextName);
            container.appendChild(row);
        }

        if (typeof window.syncRabbitModeGrid === 'function') {
            window.syncRabbitModeGrid();
        }
    }

    /**
     * 辅助：去除非数值字符后转 float（与原版 removeNonChinese 逻辑一致）
     * 保留数字、小数点、负号
     * @param {any} value - 要转换的值
     * @returns {number} - 转换后的数值（NaN 表示转换失败）
     */
    function toNumeric(value) {
        return parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    }

    /**
     * 对单个单元格执行数值对比并写入样式 class
     * @param {HTMLElement} cell
     * @param {any} inputValue  - 猜测干员的该列值
     * @param {any} targetValue - 目标干员的该列值
     * @param {number} tolerance - 近似容差（0 表示不启用近似）
     */
    function applyNumericClass(cell, inputValue, targetValue, tolerance) {
        const a = toNumeric(inputValue);
        const b = toNumeric(targetValue);

        cell.classList.remove('oper-equal', 'oper-different', 'oper-more', 'oper-less', 'oper-approximate');
        cell.removeAttribute('data-approx-detail');
        cell.removeAttribute('data-approx-tolerance');

        if (isNaN(a) || isNaN(b)) {
            cell.classList.add(String(inputValue) === String(targetValue) ? 'oper-equal' : 'oper-different');
            return;
        }
        if (a === b) {
            cell.classList.add('oper-equal');
        } else if (tolerance > 0 && Math.abs(a - b) < tolerance) {
            cell.classList.add('oper-approximate');
            cell.setAttribute('data-approx-detail', '1');
            cell.setAttribute('data-approx-tolerance', String(tolerance));
        } else if (a > b) {
            cell.classList.add('oper-more');
        } else {
            cell.classList.add('oper-less');
        }
    }

    /**
     * 对单个单元格执行模糊分类对比并写入样式 class
     * 若 inputValue === targetValue → oper-equal
     * 若同属一个父分类 → oper-fuzzy（附带 data-* 属性供 tooltip 使用）
     * 否则 → oper-different
     *
     * @param {HTMLElement} cell
     * @param {string} inputValue
     * @param {string} targetValue
     * @param {string} topLevelKey - fuzzyItemData 中的一级键（如 'CampusVague'）
     */
    function applyFuzzyClass(cell, inputValue, targetValue, topLevelKey) {
        cell.classList.remove('oper-equal', 'oper-different', 'oper-fuzzy');
        cell.removeAttribute('data-fuzzy-detail');
        cell.removeAttribute('data-fuzzy-select');
        cell.removeAttribute('data-fuzzy-parent');
        cell.removeAttribute('data-fuzzy-members');

        if (inputValue === targetValue) {
            cell.classList.add('oper-equal');
            return;
        }

        const dictGroup = window.fuzzyItemData && window.fuzzyItemData[topLevelKey];
        if (!dictGroup || typeof dictGroup !== 'object') {
            cell.classList.add('oper-different');
            return;
        }

        const findParent = (val) => {
            for (const parent in dictGroup) {
                if (!Object.prototype.hasOwnProperty.call(dictGroup, parent)) continue;
                const items = dictGroup[parent];
                if (Array.isArray(items) && items.includes(val)) return parent;
            }
            return null;
        };

        const parentInput = findParent(inputValue);
        const parentTarget = findParent(targetValue);

        if (parentInput && parentTarget && parentInput === parentTarget) {
            cell.classList.add('oper-fuzzy');
            cell.setAttribute('data-fuzzy-detail', '1');
            cell.setAttribute('data-fuzzy-select', String(targetValue ?? ''));
            cell.setAttribute('data-fuzzy-parent', String(parentInput));
            const members = dictGroup[parentInput];
            cell.setAttribute('data-fuzzy-members', JSON.stringify(Array.isArray(members) ? members : []));
        } else {
            cell.classList.add('oper-different');
        }
    }

    /**
     * 对一整行执行逐列对比着色（逐格延迟动画，与原版 verify 节奏一致）
     *
     * 列对比规则（与原版 class_RoleRow.verify 完全对齐）
     * - name / profession / position：字符串精确匹配
     * - hp：数值容差 100
     * - atk / def：数值容差 10
     * - res / block：数值容差 0（精确）
     * - reDeploy：数值容差 5
     * - cost：数值容差 1
     * - Campus / Origin / Race：模糊分类对比
     *
     * @param {HTMLElement} row - 已渲染的 .guessing-info 行元素
     * @param {Object} guessData  - 猜测干员数据
     * @param {Object} targetData - 目标干员数据
     * @returns {Promise<void>}
     */
    async function verifyRow(row, guessData, targetData) {
        if (!row || !guessData || !targetData) return;

        const DELAY_MS = 50;
        const rabbitHidden = typeof document !== 'undefined'
            && document.body.classList.contains('rabbit-mode-off');

        const step = async (callback, skipDelay = false) => {
            callback();
            if (!skipDelay) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        };

        const cell = (key) => row.querySelector(`.oper-item[data-key="${key}"]`);

        await step(() => {
            const c = cell('oper-name');
            if (c) c.classList.add(guessData.name !== targetData.name ? 'oper-different' : 'oper-equal');
        });

        await step(() => {
            const c = cell('oper-profession');
            if (c) c.classList.add(guessData.profession !== targetData.profession ? 'oper-different' : 'oper-equal');
        });

        await step(() => {
            const c = cell('oper-hp');
            if (c) applyNumericClass(c, guessData.hp, targetData.hp, 100);
        }, rabbitHidden);

        await step(() => {
            const c = cell('oper-atk');
            if (c) applyNumericClass(c, guessData.atk, targetData.atk, 10);
        }, rabbitHidden);

        await step(() => {
            const c = cell('oper-def');
            if (c) applyNumericClass(c, guessData.def, targetData.def, 10);
        }, rabbitHidden);

        await step(() => {
            const c = cell('oper-res');
            if (c) applyNumericClass(c, guessData.res, targetData.res, 0);
        }, rabbitHidden);

        await step(() => {
            const c = cell('oper-reDeploy');
            if (c) applyNumericClass(c, guessData.reDeploy, targetData.reDeploy, 5);
        }, rabbitHidden);

        await step(() => {
            const c = cell('oper-cost');
            if (c) applyNumericClass(c, guessData.cost, targetData.cost, 1);
        }, rabbitHidden);

        await step(() => {
            const c = cell('oper-block');
            if (c) applyNumericClass(c, guessData.block, targetData.block, 0);
        }, rabbitHidden);

        await step(() => {
            const c = cell('oper-position');
            if (c) c.classList.add(guessData.position !== targetData.position ? 'oper-different' : 'oper-equal');
        });

        await step(() => {
            const c = cell('oper-Campus');
            if (c) applyFuzzyClass(c, guessData.Campus, targetData.Campus, 'CampusVague');
        });

        await step(() => {
            const c = cell('oper-Origin');
            if (c) applyFuzzyClass(c, guessData.Origin, targetData.Origin, 'OriginVague');
        });

        await step(() => {
            const c = cell('oper-Race');
            if (c) applyFuzzyClass(c, guessData.Race, targetData.Race, 'RaceVague');
        });

        if (typeof window.scrollGuessingToLatest === 'function') {
            window.scrollGuessingToLatest();
        }

        bindRowTooltip(row);
    }

    /**
     * 为一行中的 oper-fuzzy / oper-approximate 格子绑定 hover 浮窗
     * - oper-fuzzy：读取 data-fuzzy-select / data-fuzzy-parent / data-fuzzy-members
     * - oper-approximate：读取 data-approx-tolerance + 当前值与目标值（从 data-key 反查）
     * @param {HTMLElement} row
     */
    function bindRowTooltip(row) {
        if (!row) return;

        const fuzzyCells = row.querySelectorAll('.oper-item.oper-fuzzy[data-fuzzy-detail="1"]');
        fuzzyCells.forEach((cell) => {
            cell.addEventListener('mouseenter', (evt) => {
                const tooltip = window.ArkdleTooltip;
                if (!tooltip) return;
                const select = (cell.textContent || '').trim();
                const parent = cell.getAttribute('data-fuzzy-parent') || '';
                const membersRaw = cell.getAttribute('data-fuzzy-members') || '[]';
                let members = [];
                try { members = JSON.parse(membersRaw); } catch (_) { }
                tooltip.showFuzzy({ select, parent, members }, evt.clientX, evt.clientY);
            });
            cell.addEventListener('mouseleave', () => {
                const tooltip = window.ArkdleTooltip;
                if (tooltip) tooltip.hide();
            });
        });

        const approxCells = row.querySelectorAll('.oper-item.oper-approximate[data-approx-detail="1"]');
        approxCells.forEach((cell) => {
            cell.addEventListener('mouseenter', (evt) => {
                const tooltip = window.ArkdleTooltip;
                if (!tooltip) return;
                const tolerance = parseFloat(cell.getAttribute('data-approx-tolerance') || '0');
                const guessVal = cell.textContent.trim();
                const a = parseFloat(String(guessVal).replace(/[^0-9.-]/g, ''));
                const targetKey = cell.getAttribute('data-key') || '';
                const targetOp = window.ArkdlePlayController?.model?.state?.targetOperator;
                const targetVal = targetOp ? targetOp[targetKey.replace('oper-', '')] : '';
                const b = parseFloat(String(targetVal || '').replace(/[^0-9.-]/g, ''));
                const direction = !isNaN(a) && !isNaN(b) ? (a > b ? 'more' : 'less') : 'less';
                tooltip.showApprox({ guessVal, targetVal, tolerance, direction }, evt.clientX, evt.clientY);
            });
            cell.addEventListener('mouseleave', () => {
                const tooltip = window.ArkdleTooltip;
                if (tooltip) tooltip.hide();
            });
        });
    }

    /**
     * 将一行渲染到容器中
     * @param {HTMLElement} container - #guessing-items
     * @param {Object} operatorData - 干员数据对象
     * @param {{clear?: boolean}=} opts - clear=true 时先清空容器（默认）
     */
    function render(container, operatorData, opts) {
        if (!container || !operatorData) return;
        const options = opts || {};
        if (options.clear !== false) {
            container.innerHTML = '';
        }
        container.appendChild(createRow(operatorData));
        // 与旧版保持一致：渲染后同步兔头模式列显隐（如果该工具函数存在）
        if (typeof window.syncRabbitModeGrid === 'function') {
            window.syncRabbitModeGrid();
        }
    }

    window.ArkdleGuessingItemRenderer = {
        createRow,
        renderPreview,
        removePreview,
        render,
        verifyRow,
    };
})();
