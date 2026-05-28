/**
 * Route Controller - 路由选择控制器
 *
 * 职责：管理数据获取路由选择
 * - 解析 URL 原始参数（不感知具体路由类型）
 * - 通过 RouteModule.resolve() 委托各路由模块自行 match() 决定接管
 * - 协调 Server 模块与 Play 模块
 * - 按需加载路由处理模块
 */
class RouteController {
    constructor() {
        this.server = window.ArkdleServer;
        this.routeModule = window.ArkdleRouteModule;
        this.routeConfig = this.parseRouteConfigFromUrl();
        this.currentRoute = this.routeConfig.routeType;
        this.isLoading = false;
        this.todayOperator = null;
        this.todayDate = '';
        this.routeHandlers = {};
        this._arkThemeT = 0;
        this._arkThemeTweenRaf = null;

        window.ArkdleRouteConfig = this.routeConfig;
        this.bindRandomTopicButton();
        this.bindDailyTopicButton();
        this.applyRouteVisualOverrides(this.currentRoute);
    }

    /**
     * 解析 URL 原始参数，输出纯数据对象
     * 不判断 routeType，由 RouteModule.resolve() 委托各路由 match() 决定
     */
    parseRouteConfigFromUrl() {
        const params = new URLSearchParams(window.location.search);

        const toBool = (v, defaultValue) => {
            if (v == null) return defaultValue;
            const s = String(v).trim().toLowerCase();
            if (s === '' || s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on') return true;
            if (s === '0' || s === 'false' || s === 'no' || s === 'n' || s === 'off') return false;
            return defaultValue;
        };

        const toIntOrNull = (v) => {
            if (v == null || String(v).trim() === '') return null;
            const n = Math.floor(Number(v));
            return Number.isFinite(n) ? n : null;
        };

        const attempts = toIntOrNull(params.get('attempts') ?? params.get('maxAttempts'));
        const allowGuessAfterAttemptsExhausted = toBool(
            params.get('continue') ?? params.get('continueGuess') ?? params.get('allowContinue') ?? params.get('allowGuessAfterLimit'),
            true
        );
        const allowRevealAnswerAfterAttemptsExhausted = toBool(
            params.get('showAnswer') ?? params.get('revealAnswer') ?? params.get('allowShowAnswer') ?? params.get('allowRevealAnswerAfterLimit'),
            true
        );
        const hintRevealAfterAttempt = toIntOrNull(params.get('hintAfter') ?? params.get('hintAt') ?? params.get('hintRevealAfterAttempt'));

        const routeType = this.routeModule.resolve(params);

        return {
            routeType,
            urlParams: params,
            attemptRules: {
                maxAttempts: attempts != null ? attempts : 8,
                allowGuessAfterAttemptsExhausted,
                allowRevealAnswerAfterAttemptsExhausted,
                hintRevealAfterAttempt,
            },
        };
    }

    bindRandomTopicButton() {
        const btn = document.getElementById('btn-random-topic');
        if (!btn) return;
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', async (evt) => {
            evt.preventDefault();
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('mode', 'random');
                url.searchParams.delete('daily');
                url.searchParams.delete('question');
                url.searchParams.delete('tiquestion');
                window.history.replaceState(null, '', url.toString());
            } catch (_) { }

            this.routeConfig = this.parseRouteConfigFromUrl();
            window.ArkdleRouteConfig = this.routeConfig;
            this.setRoute(this.routeConfig.routeType);
            await this.init({ forceNew: false });
        });
    }

    bindDailyTopicButton() {
        const btn = document.getElementById('btn-daily-topic');
        if (!btn) return;
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', async (evt) => {
            evt.preventDefault();
            try {
                const url = new URL(window.location.href);
                url.searchParams.delete('mode');
                url.searchParams.delete('random');
                url.searchParams.delete('daily');
                url.searchParams.delete('question');
                url.searchParams.delete('tiquestion');
                window.history.replaceState(null, '', url.toString());
            } catch (_) { }

            this.routeConfig = this.parseRouteConfigFromUrl();
            window.ArkdleRouteConfig = this.routeConfig;
            this.setRoute(this.routeConfig.routeType);
            await this.init({ forceNew: false });
        });
    }

    async loadRouteHandler(routeType) {
        if (this.routeHandlers[routeType]) {
            return this.routeHandlers[routeType];
        }

        const className = `Arkdle${routeType.charAt(0).toUpperCase() + routeType.slice(1)}Route`;

        if (!window[className]) {
            const routeFilePath = `./js/route/${routeType}_route.js`;
            try {
                await loadScript(routeFilePath);
            } catch (error) {
                console.error(`[RouteController] 加载路由处理模块失败: ${routeType}`, error);
            }
        }

        const HandlerClass = window[className];
        if (HandlerClass) {
            this.routeHandlers[routeType] = new HandlerClass();
            console.log(`[RouteController] 路由处理模块已就绪: ${routeType}`);
        }

        return this.routeHandlers[routeType] || null;
    }

    async init(options = null) {
        if (this.isLoading) {
            console.warn('[RouteController] 正在加载中，跳过重复请求');
            return;
        }

        this.isLoading = true;
        console.log('[RouteController] 开始路由选择和数据获取，当前路由:', this.currentRoute);

        try {
            this.applyRouteVisualOverrides(this.currentRoute);
            if (window.ArkdlePlayController && typeof window.ArkdlePlayController.setAttemptRules === 'function' && this.routeConfig?.attemptRules) {
                window.ArkdlePlayController.setAttemptRules(this.routeConfig.attemptRules);
            }

            const operatorName = await this.executeRoute(this.currentRoute, options);

            if (operatorName) {
                this.todayOperator = operatorName;
                this.todayDate = this._resolveTodayDate();
                console.log('[RouteController] 数据加载成功:', operatorName);

                this.server.onDataLoaded(operatorName, this.todayDate);
                this.server.onRouteSelected(this.currentRoute);
                this.applyRouteVisualOverrides(this.currentRoute);

                window.todayOperatorName = operatorName;
                window.arkdleTodayOperator = operatorName;
                window.arkdleTodayDate = this.todayDate;
            } else {
                console.warn('[RouteController] 数据加载失败或无数据，当前路由:', this.currentRoute);
                this.server.onDataError('无法获取数据');
                this.server.onRouteSelected(this.currentRoute);
            }
        } catch (error) {
            console.error('[RouteController] 数据获取异常:', error);
            this.server.onDataError(error.message);
            this.server.onRouteSelected(this.currentRoute);
        } finally {
            this.isLoading = false;
        }
    }

    _resolveTodayDate() {
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

    async executeRoute(routeType, options = null) {
        const handler = await this.loadRouteHandler(routeType);
        if (!handler || typeof handler.execute !== 'function') {
            console.warn(`[RouteController] 路由处理模块不存在或无 execute 方法: ${routeType}`);
            return null;
        }
        return await handler.execute(options);
    }

    setRoute(route) {
        this.currentRoute = route;
        console.log('[RouteController] 路由已切换为:', route);
        this.applyRouteVisualOverrides(route);
    }

    applyRouteVisualOverrides(route) {
        const topicSource = document.getElementById('topic-source');
        const editinfo = document.getElementById('editinfo');
        const btnDaily = document.getElementById('btn-daily-topic');

        const isRandom = route === this.routeModule.ROUTE_RANDOM;
        const isQuestion = route === this.routeModule.ROUTE_QUESTION;

        if (btnDaily) btnDaily.hidden = !isRandom;

        if (topicSource) {
            if (isQuestion) {
                topicSource.textContent = '粥友出题';
            } else if (isRandom) {
                topicSource.textContent = '本地随机题目';
            } else {
                topicSource.textContent = '每日题目';
            }
            topicSource.style.color = '';
            topicSource.style.fontWeight = '';
        }
        if (editinfo) editinfo.textContent = '';

        document.body.classList.toggle('topic-mode-random', isRandom);
        this.syncRandomTopicVisualTheme(isRandom);
    }

    syncRandomTopicVisualTheme(isRandomTopicMode) {
        const target = isRandomTopicMode ? 1 : 0;
        const startT = this._arkThemeT;

        if (Math.abs(startT - target) < 1e-5) {
            this._arkThemeT = target;
            document.documentElement.style.setProperty('--ark-theme-t', String(target));
            return;
        }

        const t0 = typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();

        const TWEEN_MS = 480;
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        if (this._arkThemeTweenRaf !== null) {
            cancelAnimationFrame(this._arkThemeTweenRaf);
            this._arkThemeTweenRaf = null;
        }

        const tick = (now) => {
            const nowMs = typeof now === 'number' ? now : (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
            const u = Math.min(1, (nowMs - t0) / TWEEN_MS);
            const k = easeOutCubic(u);
            this._arkThemeT = startT + (target - startT) * k;
            document.documentElement.style.setProperty('--ark-theme-t', this._arkThemeT.toFixed(5));
            if (u < 1) {
                this._arkThemeTweenRaf = requestAnimationFrame(tick);
            } else {
                this._arkThemeT = target;
                document.documentElement.style.setProperty('--ark-theme-t', String(target));
                this._arkThemeTweenRaf = null;
            }
        };

        this._arkThemeTweenRaf = requestAnimationFrame(tick);
    }

    getTodayOperator() {
        return this.todayOperator;
    }

    getTodayDate() {
        return this.todayDate;
    }

    getCurrentRoute() {
        return this.currentRoute;
    }

    async refresh() {
        console.log('[RouteController] 手动刷新今日题目');
        this.todayOperator = null;
        await this.init({ forceNew: true });
        return this.todayOperator;
    }
}

window.ArkdleRouteController = RouteController;

function initRouteController() {
    const controller = new RouteController();
    controller.init();

    window.ArkdleRouteController = controller;

    console.log('[Route] Route Controller 初始化完成');
}

window.initRouteController = initRouteController;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}
