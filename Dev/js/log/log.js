(() => {
    const setupCompactConsole = () => {
        const c = window.console;
        if (!c || c.__arkdle_compact_patched__) return;
        c.__arkdle_compact_patched__ = true;

        const original = {
            log: c.log?.bind(c),
            info: c.info?.bind(c),
            debug: c.debug?.bind(c),
            warn: c.warn?.bind(c),
            error: c.error?.bind(c),
            groupCollapsed: c.groupCollapsed?.bind(c),
            groupEnd: c.groupEnd?.bind(c),
        };

        const safeGetMode = () => {
            try {
                const v = localStorage.getItem('arkdle_log_mode');
                if (v === 'verbose' || v === 'compact') return v;
            } catch (_) {}
            return 'compact';
        };

        const safeSetMode = (mode) => {
            try {
                localStorage.setItem('arkdle_log_mode', mode);
            } catch (_) {}
        };

        const state = {
            mode: safeGetMode(),
            pending: {
                cacheReads: new Set(),
                cacheWrites: new Set(),
                moduleLoaded: new Set(),
                initDone: new Set(),
            },
            timers: {
                cache: 0,
                modules: 0,
                init: 0,
                dataBoot: 0,
            },
            traces: {
                route: null,
                serverToday: null,
                dataBoot: null,
            },
        };

        const getTag = (msg) => {
            if (typeof msg !== 'string') return null;
            const m = msg.match(/^\[([^\]]+)\]/);
            return m ? m[1] : null;
        };

        const getBody = (msg) => {
            if (typeof msg !== 'string') return '';
            return msg.replace(/^\[[^\]]+\]\s*/, '');
        };

        const flushCache = () => {
            state.timers.cache = 0;
            if (state.pending.cacheReads.size) {
                original.log?.('[数据管理] 读取缓存:', Array.from(state.pending.cacheReads).join(' / '));
                state.pending.cacheReads.clear();
            }
            if (state.pending.cacheWrites.size) {
                original.log?.('[数据管理] 缓存写入成功:', Array.from(state.pending.cacheWrites).join(' / '));
                state.pending.cacheWrites.clear();
            }
        };

        const flushModules = () => {
            state.timers.modules = 0;
            if (!state.pending.moduleLoaded.size) return;
            const list = Array.from(state.pending.moduleLoaded);
            state.pending.moduleLoaded.clear();
            original.log?.('[Boot] 模块已加载:', list.join(' / '));
        };

        const flushInit = () => {
            state.timers.init = 0;
            if (!state.pending.initDone.size) return;
            const list = Array.from(state.pending.initDone);
            state.pending.initDone.clear();
            original.log?.('[Boot] 初始化完成:', list.join(' / '));
        };

        const flushDataBoot = () => {
            state.timers.dataBoot = 0;
            const trace = state.traces.dataBoot;
            if (!trace) return;
            state.traces.dataBoot = null;
            const payload = {
                configVersion: trace.cloudVersion?.configVersion ?? undefined,
                appVersion: trace.cloudVersion?.appVersion ?? undefined,
            };
            if (payload.configVersion !== undefined || payload.appVersion !== undefined) {
                original.log?.('[数据管理] 云端版本:', payload);
            }
        };

        const schedule = (key, fn) => {
            if (state.timers[key]) return;
            const delay = key === 'dataBoot' ? 80 : 0;
            state.timers[key] = window.setTimeout(fn, delay);
        };

        const endRouteTrace = (trace, successText) => {
            state.traces.route = null;
            if (!trace) return;
            const payload = {
                route: trace.type,
                operator: trace.operator || undefined,
            };
            if (successText) payload.detail = successText;
            original.log?.('[Route] 路由执行完成:', payload);
        };

        const endServerTodayTrace = (trace) => {
            state.traces.serverToday = null;
            if (!trace) return;
            const payload = {
                operator: trace.operator || undefined,
                source: trace.source || undefined,
            };
            original.log?.('[Server] 今日题目:', payload);
        };

        const interceptCompact = (level, args) => {
            if (state.mode !== 'compact') return { action: 'pass' };
            const msg = args?.[0];
            if (typeof msg !== 'string') return { action: 'pass' };

            if (msg.startsWith('[数据管理] 读取缓存:')) {
                const key = String(args?.[1] ?? '').trim();
                if (key) state.pending.cacheReads.add(key);
                schedule('cache', flushCache);
                return { action: 'drop' };
            }

            if (msg.startsWith('[数据管理] 缓存写入成功:')) {
                const key = String(args?.[1] ?? '').trim();
                if (key) state.pending.cacheWrites.add(key);
                schedule('cache', flushCache);
                return { action: 'drop' };
            }

            if (msg.startsWith('[数据管理] 版本配置获取成功:')) {
                state.traces.dataBoot = state.traces.dataBoot ?? { cloudVersion: null, useCache: false, operatorsCount: null };
                const v = args?.[1];
                if (v && typeof v === 'object') state.traces.dataBoot.cloudVersion = v;
                schedule('dataBoot', flushDataBoot);
                return { action: 'drop' };
            }

            if (msg === '[数据管理] 版本一致，使用本地缓存') {
                state.traces.dataBoot = state.traces.dataBoot ?? { cloudVersion: null, useCache: false, operatorsCount: null };
                state.traces.dataBoot.useCache = true;
                return { action: 'drop' };
            }

            if (msg.startsWith('[数据管理] 本地缓存数据已恢复，共')) {
                state.traces.dataBoot = state.traces.dataBoot ?? { cloudVersion: null, useCache: false, operatorsCount: null };
                const count = Number(args?.[1]);
                if (Number.isFinite(count)) state.traces.dataBoot.operatorsCount = count;
                const payload = {
                    operators: state.traces.dataBoot.operatorsCount ?? undefined,
                    configVersion: state.traces.dataBoot.cloudVersion?.configVersion ?? undefined,
                    appVersion: state.traces.dataBoot.cloudVersion?.appVersion ?? undefined,
                };
                state.traces.dataBoot = null;
                original.log?.('[数据管理] 使用本地缓存:', payload);
                return { action: 'drop' };
            }

            if (/Module 已加载$/.test(msg)) {
                const name = getBody(msg).replace(/\s*Module 已加载$/, '').trim();
                state.pending.moduleLoaded.add(name || getTag(msg) || msg.replace(/\s*Module 已加载$/, '').trim());
                schedule('modules', flushModules);
                return { action: 'drop' };
            }

            if (/初始化完成$/.test(msg)) {
                const name = getBody(msg).replace(/\s*初始化完成$/, '').trim();
                state.pending.initDone.add(name || getTag(msg) || msg.replace(/\s*初始化完成$/, '').trim());
                schedule('init', flushInit);
                return { action: 'drop' };
            }

            if (msg === '[DailyRoute] 开始执行每日题目路由') {
                state.traces.route = { type: 'daily', operator: null };
                return { action: 'drop' };
            }
            if (msg.startsWith('[DailyRoute] 获取到每日干员:')) {
                const operator = String(args?.[1] ?? '').trim();
                if (state.traces.route?.type === 'daily') state.traces.route.operator = operator || state.traces.route.operator;
                return { action: 'drop' };
            }
            if (msg === '[DailyRoute] 每日题目路由执行完成') {
                endRouteTrace(state.traces.route, 'daily');
                return { action: 'drop' };
            }

            if (msg === '[RandomRoute] 开始执行随机题目路由') {
                state.traces.route = { type: 'random', operator: null };
                return { action: 'drop' };
            }
            if (msg.startsWith('[RandomRoute] 随机选择干员:')) {
                const operator = String(args?.[1] ?? '').trim();
                if (state.traces.route?.type === 'random') state.traces.route.operator = operator || state.traces.route.operator;
                return { action: 'drop' };
            }
            if (msg === '[RandomRoute] 随机题目路由执行完成') {
                endRouteTrace(state.traces.route, 'random');
                return { action: 'drop' };
            }

            if (msg === '[ServerController] 开始获取今日题目') {
                state.traces.serverToday = { operator: null, source: null };
                return { action: 'drop' };
            }
            if (msg.startsWith('[Server] 使用本地缓存的今日干员:')) {
                const operator = String(args?.[1] ?? '').trim();
                if (state.traces.serverToday) {
                    state.traces.serverToday.operator = operator || state.traces.serverToday.operator;
                    state.traces.serverToday.source = 'cache';
                }
                return { action: 'drop' };
            }
            if (msg.startsWith('[ServerController] 今日题目加载成功:')) {
                const operator = String(args?.[1] ?? '').trim();
                if (state.traces.serverToday) {
                    state.traces.serverToday.operator = operator || state.traces.serverToday.operator;
                    if (!state.traces.serverToday.source) state.traces.serverToday.source = 'server';
                    endServerTodayTrace(state.traces.serverToday);
                }
                return { action: 'drop' };
            }

            if (msg.startsWith('[PlayController] 处理随机干员:')) return { action: 'drop' };
            if (msg.startsWith('[PlayController] 处理每日干员:')) return { action: 'drop' };
            if (msg.startsWith('[RouteController] 开始路由选择和数据获取')) return { action: 'drop' };
            if (msg.startsWith('[RouteController] 加载路由处理模块:')) return { action: 'drop' };
            if (msg.startsWith('[Route] 路由选择:')) return { action: 'drop' };

            return { action: 'pass' };
        };

        const wrap = (level) => {
            const fn = original[level];
            if (!fn) return;
            c[level] = (...args) => {
                const r = interceptCompact(level, args);
                if (r.action === 'drop') return;
                return fn(...args);
            };
        };

        wrap('log');
        wrap('info');
        wrap('debug');
        c.warn = original.warn;
        c.error = original.error;

        window.ArkdleLog = Object.freeze({
            getMode: () => state.mode,
            setMode: (mode) => {
                if (mode !== 'verbose' && mode !== 'compact') return;
                state.mode = mode;
                safeSetMode(mode);
                if (mode === 'verbose') {
                    flushCache();
                    flushModules();
                    flushInit();
                }
            },
            flush: () => {
                flushCache();
                flushModules();
                flushInit();
            },
        });
    };

    setupCompactConsole();

    /**
     * UI 操作日志挂载器
     * 
     * 职责：为页面中所有交互元素统一挂载 console.log，
     * 不需要在业务代码里重复 bind 事件。
     * 
     * 技术要点（MVC-View 层辅助工具）
     * - 使用 capture 阶段监听：即使后续动态插入的 DOM 也会被捕获
     * - 自动识别 "button-like" 元素：button / [role="button"] / .tool-item
     * - 同时监听 input/textarea 的 input 与 keydown 事件
     * 
     * 输出示例
     * [UI][Click] { tag: "button", id: "btn-confirm", className: "btn-base", text: "确定" }
     * [UI][Input] { tag: "input", id: "input-name", type: "text", text: "推什" }
     */

    /** 获取元素可打印文本（截断过长的 innerText） */
    const getPrintableText = (el) => {
        const text = (el?.innerText ?? el?.textContent ?? '').trim();
        return text.length > 60 ? `${text.slice(0, 60)}…` : text;
    };

    /** 描述一个 DOM 元素的关键属性，用于日志输出 */
    const describeElement = (el) => {
        if (!el) return {};
        return {
            tag: el.tagName?.toLowerCase(),
            id: el.id || undefined,
            className: typeof el.className === 'string' ? el.className : undefined,
            name: el.getAttribute?.('name') || undefined,
            type: el.getAttribute?.('type') || undefined,
            text: getPrintableText(el) || undefined,
        };
    };

    /** 判断一个元素是否应被视为 "button-like" */
    const isButtonLike = (el) => {
        if (!el) return false;
        if (el.tagName === 'BUTTON') return true;
        if (el.getAttribute?.('role') === 'button') return true;
        if (el.classList?.contains('tool-item')) return true;
        return false;
    };

    /** capture 阶段：点击事件处理器 */
    const onClickCapture = (evt) => {
        const target = evt.target instanceof Element ? evt.target : null;
        // 向上查找最近的 button-like 祖先
        const buttonLike = target?.closest?.('button, [role="button"], .tool-item') ?? null;
        if (!buttonLike || !isButtonLike(buttonLike)) return;
        const payload = describeElement(buttonLike);
        // console.log('[UI][Click]', payload);
    };

    /** capture 阶段：键盘按下事件（仅 input / textarea） */
    const onKeydownCapture = (evt) => {
        const target = evt.target instanceof Element ? evt.target : null;
        if (!target) return;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
        const payload = { ...describeElement(target), key: evt.key };
        // console.log('[UI][Keydown]', payload);
    };

    /** capture 阶段：输入事件（仅 input / textarea） */
    const onInputCapture = (evt) => {
        const target = evt.target instanceof Element ? evt.target : null;
        if (!target) return;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
        const payload = describeElement(target);
        // console.log('[UI][Input]', payload);
    };

    // 注册全局捕获监听（早于冒泡，动态 DOM 也会被捕获）
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('keydown', onKeydownCapture, true);
    document.addEventListener('input', onInputCapture, true);
})();
