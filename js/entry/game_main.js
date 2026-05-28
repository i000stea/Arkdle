// 直接使用全局作用域中的函数（在 operator_data_search.js 中暴露）
const inputName = document.getElementById('input-name');
const btn_Confirm = document.getElementById('btn-confirm');
// 获取随机选择按钮元素
const btn_RandomSelect = document.getElementById('btn-random-select');
// 获取随机出题按钮元素
const btn_RandomTopic = document.getElementById('btn-random-topic');
// 获取显示正确答案按钮元素
const btn_ShowAnswer = document.getElementById('btn-show-answer');

const suggestionsContainer = document.getElementById('suggestions-container');
const guessingItems = document.getElementById('guessing-items');
const attemptsDisplay = document.getElementById('attempts').querySelector('span');

// 更新显示为服务器题目
const topicSource = document.getElementById('topic-source');
const editinfo = document.getElementById('editinfo');

// 显示正确答案按钮的点击事件处理
btn_ShowAnswer.addEventListener('click', () => {
    alert(`正确答案是：${targetData["name"]}`);
    isOver = true; // 显示答案后游戏结束
});

// 存储日志打印的定时器ID
let searchLogTimer = null;
let drawValue;

let isOver = false;
const MAX_GUESS_ATTEMPTS = 8;
let remainingAttempts = MAX_GUESS_ATTEMPTS;
let attemptsExhaustedAlertShown = false;

/** 根据剩余次数更新底部「已猜次数」展示 */
function updateGuessedAttemptsDisplay() {
    attemptsDisplay.textContent = MAX_GUESS_ATTEMPTS - remainingAttempts;
}

/** 次数用尽提示，整局仅弹一次 */
function showAttemptsExhaustedAlertOnce() {
    if (attemptsExhaustedAlertShown) return;
    attemptsExhaustedAlertShown = true;
    alert("今日次数已用尽");
}

// 动态加载依赖脚本（仅在 index.html 只加载 game_main.js 时使用）
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = false; // 保证按顺序执行
        s.onload = () => resolve(src);
        s.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
        document.head.appendChild(s);
    });
}

async function loadGameScripts() {
    const scripts = [
        'js/data/operator_data_search.js',
        'js/data/operator_name_fuzzy_search.js',
        'js/game/role_row_component.js',
        'js/ui/fuzzy_match_tooltip.js',
        'js/ui/approx_match_tooltip.js',
        'js/ui/content_drag.js',
        'js/effects/fireworks_effect.js',
        'js/effects/victory_ribbons_effect.js',
        'js/game/guess_progress_local_cache.js',
        'js/ui/screenshot/daily_win_screenshot_share.js',
        'js/ui/changelog_modal.js'
    ];
    for (const src of scripts) {
        await loadScript(src);
    }
}

const RABBIT_MODE_STORAGE_KEY = 'arkdle_rabbit_mode_on';

function readRabbitModePreference() {
    try {
        const v = localStorage.getItem(RABBIT_MODE_STORAGE_KEY);
        if (v === null) return true;
        return v === '1' || v === 'true';
    } catch (e) {
        return true;
    }
}

function syncRabbitModeGrid() {
    const off = document.body.classList.contains('rabbit-mode-off');
    document.querySelectorAll('.guessing-info').forEach((row) => {
        if (!off) {
            row.classList.remove('guessing-info--compact');
            [...row.children].forEach((cell) => {
                cell.style.removeProperty('display');
                cell.style.removeProperty('grid-column');
            });
            return;
        }
        row.classList.add('guessing-info--compact');
        let c = 1;
        [...row.children].forEach((cell) => {
            if (cell.classList.contains('rabbit-stat')) {
                cell.style.display = 'none';
                cell.style.removeProperty('grid-column');
            } else {
                cell.style.display = '';
                cell.style.gridColumn = String(c++);
            }
        });
    });
}

window.syncRabbitModeGrid = syncRabbitModeGrid;

function applyRabbitModeToggleUI(on) {
    const btn = document.getElementById('btn-rabbit-mode');
    if (btn) {
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.classList.toggle('btn-rabbit-toggle--off', !on);
    }
}

function setRabbitModeOn(on) {
    try {
        localStorage.setItem(RABBIT_MODE_STORAGE_KEY, on ? '1' : '0');
    } catch (e) {
        /* 忽略存储失败 */
    }
    document.body.classList.toggle('rabbit-mode-off', !on);
    applyRabbitModeToggleUI(on);
    syncRabbitModeGrid();
}

function initRabbitModeUI() {
    setRabbitModeOn(readRabbitModePreference());
    const btn = document.getElementById('btn-rabbit-mode');
    if (btn) {
        btn.addEventListener('click', () => {
            const curOn = !document.body.classList.contains('rabbit-mode-off');
            setRabbitModeOn(!curOn);
        });
    }
}


// 初始化时自动聚焦到输入框并加载干员数据
window.addEventListener('DOMContentLoaded', async () => {
    initRabbitModeUI();

    // 检查URL参数是否包含?edit，如果有则加载编辑模式脚本
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('edit')) {
        try {
            await loadScript('js/dev/edit_mode.js');
            console.log('[应用] 编辑模式脚本已加载');
        } catch (e) {
            console.error('[应用] 编辑模式脚本加载失败:', e);
        }
    }

    inputName.focus();

    // 先动态加载游戏依赖脚本
    try {
        await loadGameScripts();
    } catch (e) {
        console.error('依赖脚本加载失败:', e);
    }

    // 启动时检测本地缓存并打印日志（依赖 guess_progress_local_cache.js）
    checkAndLogCacheOnStartup();

    let waitOperData = loadOperatorsData();
    let waiFuzzytData = loadFuzzyItemDictionary();
    let waitAPI = initApp();
    await Promise.all([waitOperData, waiFuzzytData, waitAPI]);

    if (todayOperatorName != null) {
        // 从 operatorsData 中查找完整的干员数据
        targetData = searchOperatorByName(todayOperatorName);
        console.log("处理今日角色");
        window.arkdleGuessCacheMode = 'daily';
    } else {
        // 随机选择一个干员名称，然后从 operatorsData 中查找完整数据
        const randomOperatorName = getRandomOperator();
        if (randomOperatorName) {
            targetData = searchOperatorByName(randomOperatorName);
            window.arkdleGuessCacheMode = 'random';
        } else {
            window.arkdleGuessCacheMode = 'daily';
        }
    }

    // 监听输入框变化
    inputName.addEventListener('input', handleInputUpdate);
    // 监听随机选择按钮点击
    btn_RandomSelect.addEventListener('click', RandomInput);
    // 监听随机出题按钮点击
    btn_RandomTopic.addEventListener('click', RandomTopic);
    // 监听回车键提交
    inputName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // 检查建议列表是否显示
            const suggestionsContainer = document.getElementById('suggestions-container');
            const isSuggestionsVisible = suggestionsContainer && suggestionsContainer.style.display === 'block';

            // 如果建议列表可见，让showSuggestions中的处理逻辑先执行
            // 这里我们不阻止默认行为，让showSuggestions中的keydown事件处理函数来处理
            if (!isSuggestionsVisible) {
                // 如果建议列表不可见，则直接提交猜测
                e.preventDefault(); // 阻止可能的表单提交
                processGuess();
            }
        }
    });
    // 监听确认按钮点击
    btn_Confirm.addEventListener('click', processGuess);

    // 初始化完成后，根据缓存回放今日的历史猜测
    if (typeof applyCacheToGameIfValid === 'function') {
        applyCacheToGameIfValid(todayOperatorName != null);
    }

    if (typeof syncRabbitModeGrid === 'function') {
        syncRabbitModeGrid();
    }

    // 初始化拖拽功能
    initDragFunctionality();
});

// 处理输入框更新，显示搜索建议函数已迁移至 operator_name_fuzzy_search.js，避免在此重复定义
function DrawSelect() {
    if (drawValue == inputName.value) return;

    var getData = operatorsData[inputName.value.trim()];
    console.log(getData);
    if (getData) {
        drawValue = inputName.value;
        // 填充 guessing-item 区域

        if (!nowGuessing)
            nowGuessing = new class_RoleRow(getData, guessingItems);
        else {
            nowGuessing.refreshData(getData);
        }
        if (typeof scrollGuessingToLatest === 'function') {
            scrollGuessingToLatest();
        }
    }
}
