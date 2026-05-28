/**
 * 数据搜索模块 - 负责加载、搜索和管理干员数据
 */

// 存储所有干员数据的全局缓存变量
let operatorsData = [];
let fuzzyItemData = {};

// 目标
let targetData;
// 今日目标
let todayOperatorName;

// 当前猜测
let nowGuessing;
// 之前猜测
let beforeGuessing = [];

// 本地缓存键和值结构：{ date: 'YYYY-MM-DD', beforeGuessing: [operatorName, ...] }
// 本地缓存逻辑已迁移至 js/game/guess_progress_local_cache.js
function saveLocalCache() {
    try {
        if (typeof window.saveBeforeGuessingToCache === 'function') {
            window.saveBeforeGuessingToCache();
        } else {
            console.warn('[本地缓存] saveBeforeGuessingToCache 不可用');
        }
    } catch (e) {
        console.error('[本地缓存] 保存失败:', e);
    }
}
function checkAndLogCacheOnStartup() {
    try {
        if (typeof window.initCacheOnStart === 'function') {
            window.initCacheOnStart();
        } else {
            console.warn('[本地缓存] initCacheOnStart 不可用');
        }
    } catch (e) {
        console.error('[本地缓存] 读取失败:', e);
    }
}

function loadSaveSelectList() { }

/** 猜中正确答案后禁用 / 新局时启用：输入框、确定、随机选择 */
function setCoreGuessControlsDisabled(disabled) {
    if (typeof inputName !== 'undefined' && inputName) {
        inputName.disabled = !!disabled;
        if (disabled) inputName.blur();
    }
    if (typeof btn_Confirm !== 'undefined' && btn_Confirm) {
        btn_Confirm.disabled = !!disabled;
    }
    if (typeof btn_RandomSelect !== 'undefined' && btn_RandomSelect) {
        btn_RandomSelect.disabled = !!disabled;
    }
}

/** 将猜测表格滚动区域滚到底部，便于看到刚确认的一行 */
function scrollGuessingToLatest() {
    const sc = document.querySelector('.scroll-container');
    if (!sc) return;
    const apply = () => {
        sc.scrollTop = sc.scrollHeight;
    };
    requestAnimationFrame(() => {
        requestAnimationFrame(apply);
    });
}

// 处理用户猜测的函数
function processGuess(inputValue = null) {
    if (isOver) return;
    if (inputValue == null) inputValue = "";
    else {
        DrawSelect();
        inputValue = inputName.value.trim();
    }
    var getData = searchOperatorByName(inputValue);
    if (getData == null) {
        console.log("未找到干员");
    }
    else {
        console.log("找到干员");

        const winningRowEl = nowGuessing.getBlock();

        nowGuessing.verify(targetData);

        beforeGuessing.push(nowGuessing);
        // 每次更新 beforeGuessing 后保存到本地缓存
        saveLocalCache();

        nowGuessing = null;
        inputName.value = "";

        if (targetData["name"] == getData["name"]) {
            isOver = true;
            winningRowEl.classList.add('guessing-info--victory');
            setCoreGuessControlsDisabled(true);
            if (typeof window.playVictoryRibbonEffect === 'function') {
                window.playVictoryRibbonEffect();
            }
            // 今日模式：超过指定次数后才猜对，不提供截图分享
            const dailyWinWithinAttempts =
                window.arkdleGuessCacheMode !== 'daily' || remainingAttempts > 0;
            if (dailyWinWithinAttempts && typeof window.showArkdleDailyScreenshotShareButton === 'function') {
                window.showArkdleDailyScreenshotShareButton();
            }
            console.log("猜对了");
            return;
        } else {
            remainingAttempts--;
            updateGuessedAttemptsDisplay();

            if (remainingAttempts === 0) {
                console.log("次数用完了！");
                showAttemptsExhaustedAlertOnce();
                btn_ShowAnswer.hidden = false;
            }
        }
    }
}

/**
 * 从JSON文件加载干员数据
 * @returns {Promise<Object>} 加载的干员数据对象
 */
async function loadOperatorsData() {
    try {
        const response = await fetch('resource/data_Operators.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        operatorsData = await response.json();
        console.log('成功加载干员数据，共', Object.keys(operatorsData).length, '个干员');

        return operatorsData;
    } catch (error) {
        console.error('加载干员数据失败:', error);
        throw error; // 重新抛出错误以便调用者处理
    }
}

/**
 * 从JSON文件加载模糊项词典数据
 * @returns {Promise<Object>} 加载的模糊项词典对象
 */
async function loadFuzzyItemDictionary() {
    try {
        const response = await fetch('resource/data_FuzzyItem.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        fuzzyItemData = await response.json();
        console.log('成功加载模糊项词典，共', Object.keys(fuzzyItemData).length, '个一级分类');

        return fuzzyItemData;
    } catch (error) {
        console.error('加载模糊项词典失败:', error);
        throw error; // 重新抛出错误以便调用者处理
    }
}

/**
 * 从所有干员中随机选择一个
 * @returns {string|null} 随机选择的干员名称，如果数据为空则返回null
 */
function getRandomOperator() {
    if (!operatorsData || Object.keys(operatorsData).length === 0) {
        console.error('干员数据尚未加载或为空');
        return null;
    }

    const operatorNames = Object.keys(operatorsData);
    const randomIndex = Math.floor(Math.random() * operatorNames.length);
    const randomOperatorName = operatorNames[randomIndex];

    return randomOperatorName;
}

/**
 * 通过名字或英文名精确搜索干员数据
 * @param {string} name - 要搜索的干员名称或英文名
 * @returns {Object|null} 匹配的干员数据对象，如果没有找到则返回null
 */
function searchOperatorByName(name) {
    if (!name || !operatorsData || Object.keys(operatorsData).length === 0) {
        return null;
    }

    const lowerCaseName = name.toLowerCase();

    // 遍历所有干员数据
    for (const operatorName in operatorsData) {
        if (operatorsData.hasOwnProperty(operatorName)) {
            const operator = operatorsData[operatorName];
            // 检查干员名称或英文名是否匹配（不区分大小写）
            if (operatorName.toLowerCase() === lowerCaseName ||
                (operator.englishName && operator.englishName.toLowerCase() === lowerCaseName)) {
                return operator;
            }
        }
    }

    // 没有找到匹配的干员
    return null;
}

/** 随机出题主题混合系数，与 CSS 变量 --ark-theme-t 同步（0=每日，1=随机） */
let arkThemeT = 0;
let arkThemeTweenRaf = null;
const ARK_THEME_TWEEN_MS = 480;

function easeOutCubicTheme(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * 平滑插值切换全局背景主题（随机出题模式略偏暖紫/珊瑚光晕）
 * @param {boolean} isRandomTopicMode 是否为本地随机出题模式
 */
function syncRandomTopicVisualTheme(isRandomTopicMode) {
    const target = isRandomTopicMode ? 1 : 0;
    document.body.classList.toggle('topic-mode-random', isRandomTopicMode);
    const startT = arkThemeT;
    if (Math.abs(startT - target) < 1e-5) {
        arkThemeT = target;
        document.documentElement.style.setProperty('--ark-theme-t', String(target));
        return;
    }
    const t0 = performance.now();
    if (arkThemeTweenRaf !== null) {
        cancelAnimationFrame(arkThemeTweenRaf);
        arkThemeTweenRaf = null;
    }
    function tick(now) {
        const u = Math.min(1, (now - t0) / ARK_THEME_TWEEN_MS);
        const k = easeOutCubicTheme(u);
        arkThemeT = startT + (target - startT) * k;
        document.documentElement.style.setProperty('--ark-theme-t', arkThemeT.toFixed(5));
        if (u < 1) {
            arkThemeTweenRaf = requestAnimationFrame(tick);
        } else {
            arkThemeT = target;
            document.documentElement.style.setProperty('--ark-theme-t', String(target));
            arkThemeTweenRaf = null;
        }
    }
    arkThemeTweenRaf = requestAnimationFrame(tick);
}

// 随机选择干员名称
function RandomInput() {
    const randomOperatorName = getRandomOperator();
    if (randomOperatorName) {
        // 将随机选择的干员名称填入输入框
        inputName.value = randomOperatorName;
        // inputName.focus();
        DrawSelect();
    }
}

// 随机出题
function RandomTopic() {
    if (typeof window.hideArkdleDailyScreenshotShareButton === 'function') {
        window.hideArkdleDailyScreenshotShareButton();
    }
    // 随机选择一个干员名称，然后从 operatorsData 中查找完整数据
    const randomOperatorName = getRandomOperator();
    if (randomOperatorName) {
        window.arkdleGuessCacheMode = 'random';
        targetData = searchOperatorByName(randomOperatorName);
        console.log("随机出题", targetData.name);
        // 更新显示为本地随机题目
        topicSource.textContent = '本地随机题目';
        syncRandomTopicVisualTheme(true);
        nowGuessing = null;
        beforeGuessing = [];
        inputName.value = "";
        guessingItems.innerHTML = "";
        isOver = false;
        remainingAttempts = MAX_GUESS_ATTEMPTS;
        attemptsExhaustedAlertShown = false;
        updateGuessedAttemptsDisplay();
        btn_ShowAnswer.hidden = true;
        setCoreGuessControlsDisabled(false);
        // 重置后保存空的历史到随机出题专用缓存（不覆盖每日题目缓存）
        saveLocalCache();
        DrawSelect();
    }
}

/** 本机缓存的「服务端今日题目」干员名，与 guess 缓存使用同一日历日（Asia/Shanghai） */
const DAILY_OPERATOR_CACHE_KEY = 'arkdle_daily_operator_cache';

function readCachedDailyOperatorName() {
    try {
        const today = typeof window.getTodayStr === 'function' ? window.getTodayStr() : null;
        if (!today) return null;
        const raw = localStorage.getItem(DAILY_OPERATOR_CACHE_KEY);
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (!o || typeof o.name !== 'string' || !o.name.trim() || o.date !== today) return null;
        return o.name.trim();
    } catch (e) {
        return null;
    }
}

function saveCachedDailyOperatorName(name, serverDate) {
    try {
        const date = (typeof serverDate === 'string' && serverDate.length >= 10)
            ? serverDate.slice(0, 10)
            : (typeof window.getTodayStr === 'function' ? window.getTodayStr() : '');
        if (!date || !name) return;
        localStorage.setItem(DAILY_OPERATOR_CACHE_KEY, JSON.stringify({ date, name: String(name).trim() }));
    } catch (e) {
        console.warn('[每日题目] 本地缓存写入失败', e);
    }
}

/** 本机缓存的服务端 appVersion（与 resource/config_version.json 同步），用于离线时页脚展示 */
const APP_VERSION_DISPLAY_STORAGE_KEY = 'arkdle_cached_app_version';

function normalizeAppVersionForDisplay(raw) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s) return '';
    return /^v/i.test(s) ? s : `v${s}`;
}

function updateFooterAppVersionDisplay(rawVersion) {
    const el = document.getElementById('app-version-display');
    if (!el) return;
    const label = normalizeAppVersionForDisplay(rawVersion);
    el.textContent = label || '（版本未知）';
}

function persistAndShowAppVersion(raw) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s) return;
    try {
        localStorage.setItem(APP_VERSION_DISPLAY_STORAGE_KEY, s);
    } catch (e) {
        console.warn('[版本] 缓存 appVersion 失败', e);
    }
    updateFooterAppVersionDisplay(s);
}

/** @returns {boolean} 是否已从 localStorage 写入页脚 */
function applyCachedAppVersionToFooterIfAny() {
    let s = '';
    try {
        s = localStorage.getItem(APP_VERSION_DISPLAY_STORAGE_KEY) || '';
    } catch (e) {
        return false;
    }
    const t = String(s).trim();
    if (!t) return false;
    updateFooterAppVersionDisplay(t);
    return true;
}

/** 将 API 返回的 dayrandom 调试日志打印到浏览器控制台 */
function logDayrandomServerDebug(apiPayload) {
    const log = apiPayload && apiPayload.data && typeof apiPayload.data.dayrandomDebugLog === 'string'
        ? apiPayload.data.dayrandomDebugLog.trim()
        : '';
    if (!log.length) return;
    console.log('%c[ArkDle/dayrandom 服务端]', 'color:#6a737d;font-weight:bold;', '\n' + log);
}

// 初始化时访问后端API获取测试信息和今日角色名称
async function initApp() {
    try {
        console.log('正在连接后端服务器...');
        // 增加5秒超时限制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('https://arkdle.milletea.top/api/server.php', { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await response.json();
        logDayrandomServerDebug(data);

        const dd = data && data.data;
        const rawAv = dd && (dd.appVersion != null ? dd.appVersion : dd.version);
        if (rawAv !== undefined && rawAv !== null && String(rawAv).trim() !== '') {
            persistAndShowAppVersion(String(rawAv));
        } else {
            applyCachedAppVersionToFooterIfAny();
        }

        if (data.data && typeof window.syncServerConfigVersion === 'function') {
            window.syncServerConfigVersion(data.data.configVersion);
        }

        const rawName = data.data && data.data.todayOperatorName;
        const serverDate = data.data && data.data.todayDate;
        const name = typeof rawName === 'string' ? rawName.trim() : '';

        if (name) {
            todayOperatorName = name;
            saveCachedDailyOperatorName(todayOperatorName, serverDate);
            topicSource.textContent = '当前题目为今日随机';
            topicSource.style.color = '';
            topicSource.style.fontWeight = '';
            syncRandomTopicVisualTheme(false);
        } else {
            const cached = readCachedDailyOperatorName();
            if (cached) {
                todayOperatorName = cached;
                topicSource.textContent = '当前题目为今日随机（使用本机记录的今日题目）';
                topicSource.style.color = '';
                topicSource.style.fontWeight = '';
                syncRandomTopicVisualTheme(false);
            }
        }
    } catch (error) {
        console.error('连接后端服务器失败:', error);
        if (!applyCachedAppVersionToFooterIfAny()) {
            updateFooterAppVersionDisplay('');
        }
        const cached = readCachedDailyOperatorName();
        if (cached) {
            todayOperatorName = cached;
            topicSource.textContent = '当前题目为今日随机（离线：本机今日题目）';
            topicSource.style.color = '';
            topicSource.style.fontWeight = '';
            syncRandomTopicVisualTheme(false);
        } else {
            RandomTopic();
            topicSource.textContent = '网络连接错误，已进行本地随机角色，若获取当日角色请重试';
            topicSource.style.color = 'red';
            topicSource.style.fontWeight = 'bold';
        }
    }
}

applyCachedAppVersionToFooterIfAny();