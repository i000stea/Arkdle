/**
 * 模糊搜索模块 - 仅负责提供基于 operatorsData 的干员名称模糊匹配
 * 依赖：全局变量 operatorsData（由 operator_data_search.js 加载并维护）
 */

/**
 * 根据搜索词模糊搜索干员（相关性排序）
 * 支持中文名、英文名、拼音全拼(pinyinAll)及简拼(pinyinFirst)
 * @param {string} searchTerm - 搜索关键词
 * @returns {Array<string>} 排序后的匹配干员名称数组
 */
function searchOperators(searchTerm) {
    if (!searchTerm || !operatorsData || Object.keys(operatorsData).length === 0) {
        return [];
    }

    const normalize = (s) => (s || '').toString().toLowerCase();
    const term = normalize(searchTerm.trim());
    const termNoSpace = term.replace(/\s+/g, '');

    const results = [];

    for (const name in operatorsData) {
        if (!Object.prototype.hasOwnProperty.call(operatorsData, name)) continue;
        const op = operatorsData[name] || {};

        const cn = normalize(name);
        const en = normalize(op.englishName);
        const pAll = normalize(op.pinyinAll);
        const pAllNoSpace = pAll.replace(/\s+/g, '');
        const pFirst = normalize(op.pinyinFirst);

        let score = 0;
        let bestPos = Infinity; // 用于同分时根据最早匹配位置排序

        // 精确匹配优先
        if (cn === term) { score = Math.max(score, 100); bestPos = 0; }
        if (en && en === term) { score = Math.max(score, 98); bestPos = 0; }
        if (pFirst && pFirst === term) { score = Math.max(score, 97); bestPos = 0; }
        if (pAll && pAllNoSpace === termNoSpace) { score = Math.max(score, 96); bestPos = 0; }

        // 前缀匹配次之
        if (!score) {
            if (cn.startsWith(term)) { score = Math.max(score, 90); bestPos = 0; }
            if (en && en.startsWith(term)) { score = Math.max(score, 88); bestPos = 0; }
            if (pFirst && pFirst.startsWith(term)) { score = Math.max(score, 87); bestPos = 0; }
            if (pAll && pAllNoSpace.startsWith(termNoSpace)) { score = Math.max(score, 86); bestPos = 0; }
        }

        // 子串匹配再次之（位置越靠前略优）
        if (!score) {
            const posCN = cn.indexOf(term);
            const posEN = en ? en.indexOf(term) : -1;
            const posPF = pFirst ? pFirst.indexOf(term) : -1;
            const posPA = pAllNoSpace ? pAllNoSpace.indexOf(termNoSpace) : -1;

            if (posCN >= 0) { score = Math.max(score, 80); bestPos = Math.min(bestPos, posCN); }
            if (posEN >= 0) { score = Math.max(score, 78); bestPos = Math.min(bestPos, posEN); }
            if (posPF >= 0) { score = Math.max(score, 77); bestPos = Math.min(bestPos, posPF); }
            if (posPA >= 0) { score = Math.max(score, 76); bestPos = Math.min(bestPos, posPA); }
        }

        if (score > 0) {
            results.push({ name, score, pos: bestPos, len: name.length });
        }
    }

    // 排序规则：分数高 -> 位置早 -> 名称短 -> 字典序
    results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.pos !== b.pos) return a.pos - b.pos;
        if (a.len !== b.len) return a.len - b.len;
        return a.name.localeCompare(b.name, 'zh');
    });

    return results.map(r => r.name);
}

// 处理输入框更新，显示搜索建议（迁移自 game_main.js）
function handleInputUpdate() {
    const searchTerm = inputName.value.trim();
    // 重置当前选中项索引
    selectedSuggestionIndex = -1;

    // 清除之前的定时器（如果存在）
    if (searchLogTimer) {
        clearTimeout(searchLogTimer);
    }

    // 设置新的延迟打印日志的定时器
    searchLogTimer = setTimeout(DrawSelect, 500);

    // 清空之前的建议列表
    if (suggestionsContainer) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none';
    }

    // 执行搜索
    const matchingOperators = searchOperators(searchTerm);

    // 如果有匹配的干员，显示建议列表
    if (matchingOperators.length > 0 && suggestionsContainer) {
        suggestionsContainer.style.display = 'block';
        if (!isKeydownListening) {
            document.addEventListener('keydown', handleKeyDown);
            isKeydownListening = true;
        }

        // 限制显示的建议数量（最多显示10个）
        const displayCount = Math.min(matchingOperators.length, 10);

        for (let i = 0; i < displayCount; i++) {
            const operatorName = matchingOperators[i];
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = operatorName;

            // 点击建议项时，将干员名称填入输入框并隐藏建议列表
            suggestionItem.addEventListener('click', () => {
                inputName.value = operatorName;
                suggestionsContainer.style.display = 'none';
                document.removeEventListener('keydown', handleKeyDown);
                isKeydownListening = false;
                DrawSelect();
            });

            suggestionsContainer.appendChild(suggestionItem);
        }

        // 在建议列表隐藏时移除键盘事件监听
        const hideHandler = function () {
            document.removeEventListener('keydown', handleKeyDown);
            suggestionsContainer.removeEventListener('hidden', hideHandler);
        };

        // 监听建议列表的隐藏事件
        suggestionsContainer.addEventListener('hidden', hideHandler);

        // 当点击文档其他地方时隐藏建议列表
        document.addEventListener('click', function hideSuggestionsOnClickOutside(event) {
            if (!suggestionsContainer.contains(event.target) && event.target !== inputName) {
                suggestionsContainer.style.display = 'none';
                document.removeEventListener('keydown', handleKeyDown);
                isKeydownListening = false;
                document.removeEventListener('click', hideSuggestionsOnClickOutside);
            }
        });
    }
}

// 新增：更新选中样式
function updateSuggestionSelection(items) {
    for (let i = 0; i < items.length; i++) {
        items[i].classList.toggle('selected', i === selectedSuggestionIndex);
    }
}

// 新增：键盘事件处理（上下选择、空格确定）
function handleKeyDown(e) {
    if (!suggestionsContainer || suggestionsContainer.style.display !== 'block') return;

    const items = suggestionsContainer.querySelectorAll('.suggestion-item');
    if (!items || items.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex + 1) % items.length;
        updateSuggestionSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex - 1 + items.length) % items.length;
        updateSuggestionSelection(items);
    } else if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
            const operatorName = items[selectedSuggestionIndex].textContent;
            inputName.value = operatorName;
            suggestionsContainer.style.display = 'none';
            document.removeEventListener('keydown', handleKeyDown);
            isKeydownListening = false;
            DrawSelect();
        }
    }
}

// 用于控制是否已添加键盘事件监听，避免重复绑定
let isKeydownListening = false;
// 当前选中的建议项索引（在 handleInputUpdate 中会重置为 -1）
let selectedSuggestionIndex = -1;