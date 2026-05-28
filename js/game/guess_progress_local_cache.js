const CACHE_KEY = 'arkdle_beforeGuessing_cache';
/** 本地随机出题模式的猜测记录，与每日题目分离，避免随机出题时用空进度覆盖今日答题缓存 */
const CACHE_KEY_RANDOM = 'arkdle_beforeGuessing_cache_random';
/** 本地记录的上一次服务端 configVersion（与 resource/config_version.json 的 configVersion 字段对应；同文件的 appVersion 由 operator_data_search 单独缓存用于页脚） */
const CONFIG_VERSION_STORAGE_KEY = 'arkdle_cached_config_version';

/** 与「配置/题目进度」相关的 localStorage 键，版本不一致时清除 */
const CONFIG_RELATED_CACHE_KEYS = [CACHE_KEY, CACHE_KEY_RANDOM];

function clearConfigRelatedLocalCache() {
  for (const key of CONFIG_RELATED_CACHE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[缓存] 清除键失败:', key, e);
    }
  }
}

/**
 * 根据服务端 configVersion 同步本地：无记录则写入；一致则不动；不一致则清配置缓存再写入。
 * @param {string|number} serverConfigVersion 服务端返回的 data.configVersion
 */
function syncServerConfigVersion(serverConfigVersion) {
  if (serverConfigVersion === undefined || serverConfigVersion === null) {
    return;
  }
  const serverStr = String(serverConfigVersion);
  let cached;
  try {
    cached = localStorage.getItem(CONFIG_VERSION_STORAGE_KEY);
  } catch (e) {
    console.warn('[缓存] 读取配置版本失败:', e);
    return;
  }

  if (cached === null) {
    try {
      localStorage.setItem(CONFIG_VERSION_STORAGE_KEY, serverStr);
    } catch (e) {
      console.warn('[缓存] 写入配置版本失败:', e);
    }
    console.log('[缓存] 首次记录服务端配置版本:', serverStr);
    return;
  }

  if (cached === serverStr) {
    return;
  }

  clearConfigRelatedLocalCache();
  try {
    localStorage.setItem(CONFIG_VERSION_STORAGE_KEY, serverStr);
  } catch (e) {
    console.warn('[缓存] 更新配置版本失败:', e);
  }
  console.log('[缓存] 配置版本已变更，已清除相关本地缓存，当前版本:', serverStr);
}

if (typeof window !== 'undefined') {
  window.syncServerConfigVersion = syncServerConfigVersion;
  window.clearConfigRelatedLocalCache = clearConfigRelatedLocalCache;
  window.getTodayStr = getTodayStr;
}

/** 与 api/server.php 的 Asia/Shanghai 日历日对齐，用于今日题目与 guess 缓存 */
function getTodayStr() {
  try {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10);
  } catch (e) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

function saveBeforeGuessingToCache() {
  try {
    // 将 beforeGuessing 序列化为干员名称列表，过滤掉空值
    const names = Array.isArray(beforeGuessing)
      ? beforeGuessing
        .map(row => (row && row.data && row.data.name) ? row.data.name : null)
        .filter(Boolean)
      : [];

    const payload = {
      date: getTodayStr(),
      beforeGuessing: names,
    };

    const useRandomKey = typeof window !== 'undefined' && window.arkdleGuessCacheMode === 'random';
    const key = useRandomKey ? CACHE_KEY_RANDOM : CACHE_KEY;
    localStorage.setItem(key, JSON.stringify(payload));
    console.log('[缓存] 已保存 beforeGuessing:', key, payload);
  } catch (e) {
    console.warn('[缓存] 保存失败:', e);
  }
}

function initCacheOnStart() {
  try {
    const rawDaily = localStorage.getItem(CACHE_KEY);
    const rawRandom = localStorage.getItem(CACHE_KEY_RANDOM);
    if (rawDaily) {
      console.log('[缓存] 发现每日缓存:', JSON.parse(rawDaily));
    }
    if (rawRandom) {
      console.log('[缓存] 发现随机出题缓存:', JSON.parse(rawRandom));
    }
    if (!rawDaily && !rawRandom) {
      console.log('[缓存] 未发现缓存');
    }
  } catch (e) {
    console.warn('[缓存] 读取失败:', e);
  }
}

// 在初始化完成且已设置目标后，若缓存存在且日期为今日，则回放今日的历史猜测
/**
 * @param {boolean} isDailyTopic 为 true 时回放「每日题目」缓存；为 false 时回放「随机出题」缓存
 */
function applyCacheToGameIfValid(isDailyTopic) {
  try {
    const key = isDailyTopic ? CACHE_KEY : CACHE_KEY_RANDOM;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const obj = JSON.parse(raw);

    if (!obj || obj.date !== (typeof window.getTodayStr === 'function' ? window.getTodayStr() : getTodayStr())) {
      console.log('[缓存] 日期不一致或缓存无效，跳过回放', key);
      return;
    }

    if (!Array.isArray(obj.beforeGuessing) || obj.beforeGuessing.length === 0) {
      console.log('[缓存] 今日无历史猜测可回放', key);
      return;
    }

    console.log('[缓存] 与今日一致，开始回放历史猜测:', key, obj.beforeGuessing);
    for (const name of obj.beforeGuessing) {
      if (!name) continue;
      // 设置输入框并依次执行猜测流程
      inputName.value = name;
      // 触发绘制以准备 nowGuessing
      if (typeof DrawSelect === 'function') {
        DrawSelect();
      }
      // 调用核心猜测流程（processGuess 会读取 inputName.value）
      if (typeof processGuess === 'function') {
        processGuess(name);
      }
    }
  } catch (e) {
    console.warn('[缓存] 回放失败:', e);
  }
}
