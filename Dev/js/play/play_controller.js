/**
 * Play Controller - MVC 中的 Controller 层
 *
 * 职责：处理 UI 交互，协调 Model 和 View
 * - 处理随机选择按钮点击
 * - 从角色数据库随机选择干员
 * - 更新输入框和显示干员数据
 *
 * 依赖说明
 * - 数据源：window.operatorsData（由 Refactor/js/data/data_manager.js + Refactor/js/app/app.js 在启动时加载并挂载）
 * - View：负责把状态变化映射到 UI（这里具体表现为输入框回填 + guessing-items 绘制）
 * - Model：只存状态，并通过 change 事件通知外界
 */

class PlayController {
    constructor(model, view) {
        // 依赖注入：Controller 不自行 new Model/View，便于测试与替换实现（典型 MVC 协作方式）
        this.model = model;
        this.view = view;
        // 输入预览的防抖定时器（debounce）
        // 目的：用户连续输入时不做高频匹配与 DOM 更新，只在"停顿一小段时间"后再执行精确匹配
        this._inputPreviewTimer = null;
        this._rabbitModeView = null;
        this._suppressDailyPersist = false;
        this._isReplayingDailyGuessCache = false;
    }

    /** 初始化：绑定事件 */
    init() {
        this.initRabbitModeView();
        // 统一在 init 里完成所有事件绑定，避免构造函数做重逻辑，保证实例化与初始化职责清晰
        this.bindRandomSelect();
        this.bindConfirmClick();
        this.bindPreviewEvent();
        this.bindInputPreview();
        this.bindShowAnswer();

        // 订阅 Model 变化
        this.model.addEventListener('change', (evt) => {
            const state = evt.detail?.state;
            const changedKeys = evt.detail?.changedKeys || [];
            if (!state) return;
            // 当随机选择干员后，更新 View（Controller 作为协调者，不直接拼 DOM）
            if (changedKeys.includes('randomOperator') || changedKeys.includes('randomOperatorName')) {
                if (!state.randomOperator) return;
                this.view.setInputName(state.randomOperatorName);
                this.view.renderOperatorData(state.randomOperator);
            }
            if (changedKeys.includes('guessHistory')) {
                this.view.updateAttemptsUsed(Array.isArray(state.guessHistory) ? state.guessHistory.length : 0);
            }

            if (this.isDailyMode()
                && !this._suppressDailyPersist
                && !this._isReplayingDailyGuessCache
                && (
                    changedKeys.includes('targetOperatorName')
                    || changedKeys.includes('guessHistory')
                    || changedKeys.includes('gameOver')
                    || changedKeys.includes('isVictory')
                    || changedKeys.includes('attemptsExhausted')
                    || changedKeys.includes('hintShown')
                )
            ) {
                if (typeof this.model.saveDailyGuessProgress === 'function') {
                    this.model.saveDailyGuessProgress();
                }
            }
        });

        this.view.updateAttemptsUsed(0);
        this.view.setShowAnswerVisible(false);
        this.view.setHint('', false);
    }
    /** 初始化兔头模式视图 */
    initRabbitModeView() {
        const start = () => {
            const Cls = window.ArkdleRabbitModeView;
            if (!Cls) return;
            if (this._rabbitModeView) return;
            try {
                this._rabbitModeView = new Cls(document);
                this._rabbitModeView.init();
                this._rabbitModeView.addEventListener('toggle', (evt) => {
                    const enabled = !!(evt && evt.detail && evt.detail.enabled);
                    if (this._rabbitModeView) this._rabbitModeView.setEnabled(enabled);
                });
                const initialEnabled = typeof this._rabbitModeView.getPreferredEnabled === 'function'
                    ? !!this._rabbitModeView.getPreferredEnabled()
                    : true;
                this._rabbitModeView.apply(initialEnabled);
            } catch (_) { }
        };

        if (window.ArkdleRabbitModeView) {
            start();
            return;
        }

        const existing = document.querySelector('script[data-arkdle-rabbit-mode-view="1"]');
        if (existing) return;

        const s = document.createElement('script');
        s.src = './js/play/rabbit_mode_view.js';
        s.async = false;
        s.dataset.arkdleRabbitModeView = '1';
        s.onload = () => start();
        s.onerror = () => { };
        document.head.appendChild(s);
    }

    /** 绑定随机选择按钮事件 */
    bindRandomSelect() {
        // Controller 直接监听 DOM 事件（用户交互入口），然后把业务流程交给 handleXxx 方法统一处理
        const btn = document.getElementById('btn-random-select');
        if (!btn) return;

        btn.addEventListener('click', (evt) => {
            // 阻止按钮默认行为（例如 form submit / 锚点跳转），保证交互只触发游戏逻辑
            evt.preventDefault();
            this.handleRandomSelect();
        });
    }

    /** 处理随机选择 从角色数据库中随机选择一个干员 */
    handleRandomSelect() {
        // 数据源由启动流程加载并挂到 window（见文件头部依赖说明）。此处做防御式检查，避免空数据导致异常
        if (!window.operatorsData || Object.keys(window.operatorsData).length === 0) {
            console.warn('[PlayController] 干员数据尚未加载');
            return;
        }

        // 从 operatorsData 中随机选择一个干员
        const operatorNames = Object.keys(window.operatorsData);
        const randomIndex = Math.floor(Math.random() * operatorNames.length);
        const randomName = operatorNames[randomIndex];
        const randomOperator = window.operatorsData[randomName];

        // 更新 Model
        // 这里使用 patch 而不是直接改 state：由 Model 统一触发 change 事件，保持单向数据流
        this.model.patch({
            randomOperator: randomOperator,
            randomOperatorName: randomName,
        });

        // 同步更新 View：即刻把随机结果写入输入框并渲染信息
        // 说明：虽然 init() 里也订阅了 model change 并会触发 render，这里仍主动调用一次，
        // 目的是保证用户即时反馈；如果未来希望“严格由订阅驱动 UI”，可删除这里两行并依赖订阅回调统一渲染
        this.view.setInputName(randomName);
        this.view.renderOperatorData(randomOperator);

        console.log('[PlayController] 随机选择干员:', randomName);
    }

    /** 设置本局目标干员（由路由层调用） */
    setTarget(operatorName, operatorData) {
        // 初始化/重置一局游戏的核心状态：答案、历史、终局标记、次数相关标记、提示标记
        // 注意：Controller 负责“协调”，Model 只负责“存状态并派发变化”
        this.model.patch({
            targetOperator: operatorData,
            targetOperatorName: operatorName,
            guessHistory: [],
            gameOver: false,
            isVictory: false,
            attemptsExhausted: false,
            hintShown: false,
        });
        // UI 也需要同步复位，避免残留上一局的显示（次数、提示、禁用状态等）
        this.view.updateAttemptsUsed(0);
        this.view.setShowAnswerVisible(false);
        this.view.setHint('', false);
        this.view.setGuessControlsDisabled(false);
    }

    /** 设置尝试规则 */
    setAttemptRules(rules) {
        // 规则配置入口：由外部（路由/配置模块）传入，Controller 负责做“安全清洗 + 写入 Model”
        const next = { ...(rules || {}) };
        const maxAttempts = next.maxAttempts;
        // maxAttempts：仅接受正整数；否则保持现有配置，避免把非法值写入状态导致逻辑分支失效
        const safeMaxAttempts = (typeof maxAttempts === 'number' && Number.isFinite(maxAttempts) && maxAttempts > 0)
            ? Math.floor(maxAttempts)
            : this.model.state.maxAttempts;
        // allowGuessAfterAttemptsExhausted：耗尽后是否允许继续猜（null/undefined 表示不覆盖）
        const allowGuessAfterAttemptsExhausted = next.allowGuessAfterAttemptsExhausted != null
            ? !!next.allowGuessAfterAttemptsExhausted
            : this.model.state.allowGuessAfterAttemptsExhausted;
        // allowRevealAnswerAfterAttemptsExhausted：耗尽后是否允许展示“查看答案”入口（null/undefined 表示不覆盖）
        const allowRevealAnswerAfterAttemptsExhausted = next.allowRevealAnswerAfterAttemptsExhausted != null
            ? !!next.allowRevealAnswerAfterAttemptsExhausted
            : this.model.state.allowRevealAnswerAfterAttemptsExhausted;
        // hintRevealAfterAttempt：第 N 次猜测后自动揭示提示；空值表示关闭；最小从 1 开始
        const hintRevealAfterAttempt = (next.hintRevealAfterAttempt == null || next.hintRevealAfterAttempt === '')
            ? null
            : Math.max(1, Math.floor(Number(next.hintRevealAfterAttempt)));

        // 统一写回 Model，保证规则变化可被其它模块订阅/回放（例如未来做“设置面板”或“本地存档”）
        this.model.patch({
            maxAttempts: safeMaxAttempts,
            allowGuessAfterAttemptsExhausted,
            allowRevealAnswerAfterAttemptsExhausted,
            hintRevealAfterAttempt: Number.isFinite(hintRevealAfterAttempt) ? hintRevealAfterAttempt : null,
        });
    }

    /**
     * 处理目标干员（从路由传入）
     *
     * 设计目的：
     * - 把“设置本局目标 + UI 复位”收敛成唯一入口，避免 Daily/Random 等模式在 Controller 内部分叉，导致职责膨胀。
     * - 所有“模式差异”（例如：Daily 的进度回放、本地随机的换题、出题模式等）统一由各自路由编排。
     *
     * 方法边界（非常重要）：
     * - 这里【只做】开局的通用动作：写入 Model 的 target/重置局内状态 + 清理 UI 残留。
     * - 这里【不做】任何“路由特有”的副作用：不与 Server 上报交互、不读取 localStorage、不做每日进度恢复。
     *   这些动作应由路由层决定调用顺序（例如是否需要抑制存档、是否需要回放历史等）。
     *
     * @param {string} operatorName - 干员名称
     * @param {Object} operatorData - 干员数据
     */
    handleTargetOperator(operatorName, operatorData) {
        // 仅用于调试：路由层每次选出目标后，这里能快速确认本局答案是否按预期切换
        console.log('[PlayController] 处理目标干员:', operatorName);
        // setTarget 会重置 gameOver/guessHistory/提示/次数等局内状态，保证“新局一定是干净的”
        this.setTarget(operatorName, operatorData);
        // UI 侧清理：输入框和猜测列表必须在开局时清空，避免上一局残留造成“视觉与状态不一致”
        this.view.clearInput();
        this.view.clearGuessingItems();
    }

    setDailyPersistSuppressed(suppressed) {
        // Daily 进度存档抑制开关：
        // - Daily 模式下，Controller 会在 Model change 时自动 saveDailyGuessProgress（见 init() 内订阅）
        // - 但当路由“切换目标”或“准备回放历史”时，Model 会先经历一次 setTarget 的重置（guessHistory 变空）
        //   如果不抑制，可能会把“空历史”立即写回，覆盖掉旧存档，导致回放数据丢失
        // - 因此由路由在关键区间（切目标、回放）前后显式开关，确保存档写入时机正确
        this._suppressDailyPersist = !!suppressed;
    }

    /** 是否为每日模式 */
    isDailyMode() {
        const cfg = window.ArkdleRouteConfig;
        return !!(cfg && cfg.routeType === 'daily');
    }

    /** 恢复每日猜测进度 */
    // 从 Model 加载并回放已猜的干员，确保游戏状态与 Model 一致
    restoreDailyGuessProgress(operatorName) {
        if (!operatorName) return;
        if (typeof this.model.loadDailyGuessProgress !== 'function') return;
        const names = this.model.loadDailyGuessProgress(operatorName);
        if (!names || names.length === 0) {
            if (typeof this.model.saveDailyGuessProgress === 'function') {
                this.model.saveDailyGuessProgress();
            }
            return;
        }

        this._isReplayingDailyGuessCache = true;
        try {
            for (const name of names) {
                if (!name) continue;
                if (this.model.state.gameOver) break;
                this.view.setInputName(name);
                this.previewByName(name);
                this.handleConfirmClick();
            }
        } finally {
            this._isReplayingDailyGuessCache = false;
        }

        if (typeof this.model.saveDailyGuessProgress === 'function') {
            this.model.saveDailyGuessProgress();
        }
    }

    /** 绑定确认按钮点击事件 */
    // 确认按钮是核心交互入口：绑定一次点击事件后转交给 handleConfirmClick 处理完整流程
    bindConfirmClick() {
        const btn = document.getElementById('btn-confirm');
        if (!btn) return;

        btn.addEventListener('click', (evt) => {
            evt.preventDefault();
            this.handleConfirmClick();
        });
    }

    /** 绑定预览事件 */
    bindPreviewEvent() {
        // 预览事件来自 UI 层（例如 Renderer 在输入时广播），Controller 收到后做数据查找并驱动 View 渲染
        window.addEventListener('arkdle:ui:preview', (evt) => {
            const name = evt?.detail?.name || '';
            if (!name) return;
            this.previewByName(name);
        });
    }

    /** 绑定输入框预览事件 */
    bindInputPreview() {
        // 输入框预览：监听 input 事件，做防抖精确匹配，命中则渲染预览行，未命中则移除预览
        const input = this.view?.els?.inputName;
        if (!input) return;

        const renderer = window.ArkdleGuessingItemRenderer;
        const container = this.view?.els?.guessingItems;

        // 预览命中延迟（ms）
        // 300ms：体验上更"跟手"，同时仍能避免每次按键都触发一次精确查找 + 渲染
        const PREVIEW_DEBOUNCE_MS = 300;

        const clearTimer = () => {
            if (this._inputPreviewTimer !== null) {
                clearTimeout(this._inputPreviewTimer);
                this._inputPreviewTimer = null;
            }
        };

        // 统一"移除预览行"的入口：未命中、输入清空、或延迟回调发现输入已变更为空
        const removePreviewNow = () => {
            if (renderer && typeof renderer.removePreview === 'function' && container) {
                renderer.removePreview(container);
            }
        };

        input.addEventListener('input', () => {
            // 读取并 trim，避免纯空格触发查找
            const text = typeof input.value === 'string' ? input.value.trim() : '';

            // 输入清空：立即移除预览行，并取消未执行的定时器
            if (!text) {
                clearTimer();
                removePreviewNow();
                return;
            }

            clearTimer();
            this._inputPreviewTimer = setTimeout(() => {
                this._inputPreviewTimer = null;

                // 延迟回调里必须再次读取 input.value：
                // 因为用户可能在 300ms 内继续输入/删除，导致最初捕获的 text 已过期
                const latest = typeof input.value === 'string' ? input.value.trim() : '';
                if (!latest) {
                    removePreviewNow();
                    return;
                }

                // 精确匹配：中文名 key 或 englishName（忽略大小写）
                const op = this.findOperatorByNameOrEnglish(latest);
                if (op) {
                    // 命中：更新/复用预览行（若同名预览行已存在，Renderer 会直接 return，不做重复渲染）
                    this.view.renderOperatorData(op);
                } else {
                    // 未命中：不显示，并移除可能残留的预览行
                    removePreviewNow();
                }
            }, PREVIEW_DEBOUNCE_MS);
        });
    }

    /** 获取当前输入框值 */
    // 优先从 View 缓存的 input 引用读取（更快且更符合 MVC：View 管 DOM 引用）
    getCurrentInputValue() {
        // 优先从 View 缓存的 input 引用读取（更快且更符合 MVC：View 管 DOM 引用）
        const input = this.view?.els?.inputName;
        if (input && typeof input.value === 'string') return input.value.trim();
        // 兜底：如果 View 未初始化或引用丢失，则直接从 DOM 查询
        const el = document.getElementById('input-name');
        return typeof el?.value === 'string' ? el.value.trim() : '';
    }

    /** 查找干员数据 */
    findOperatorByNameOrEnglish(name) {
        // 统一的数据查找方法：确保所有“输入→干员数据”的映射逻辑在一个地方，便于维护与扩展（如别名/拼音）
        const data = window.operatorsData;
        if (!data || Object.keys(data).length === 0) return null;
        const trimmed = (name || '').trim();
        if (!trimmed) return null;

        // 1) 直接用中文名做 key 查找：最快路径
        const direct = data[trimmed];
        if (direct) return direct;

        // 2) 英文名查找：遍历所有干员并对 englishName 做大小写归一
        const lower = trimmed.toLowerCase();
        for (const key in data) {
            if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
            const op = data[key];
            const en = (op?.englishName || '').toString().toLowerCase();
            if (en && en === lower) return op;
        }

        return null;
    }

    /** 预览干员数据 */
    previewByName(name) {
        // 预览逻辑：输入命中干员则渲染数据；未命中则移除预览行（避免误导用户）
        const op = this.findOperatorByNameOrEnglish(name);
        const renderer = window.ArkdleGuessingItemRenderer;
        const container = this.view?.els?.guessingItems;
        if (!op) {
            if (renderer && typeof renderer.removePreview === 'function' && container) {
                renderer.removePreview(container);
            }
            return;
        }
        this.view.renderOperatorData(op);
    }
    /** 处理“确认”点击事件 */
    handleConfirmClick() {
        // 兜底：如果游戏已经结束（胜利/失败/手动结束），则直接忽略本次点击，避免重复结算与状态被二次覆盖
        if (this.model.state.gameOver) return;

        // 从输入框读取玩家本次提交的名字（会做 trim），空输入直接返回，不进行任何提示渲染与状态写入
        const name = this.getCurrentInputValue();
        if (!name) return;

        // 将玩家输入映射到干员数据：
        // - 优先匹配中文名（data[name]）
        // - 兜底匹配英文名（englishName，忽略大小写）
        // 找不到则不进入验证流程，避免后续引用空对象
        const guessOp = this.findOperatorByNameOrEnglish(name);
        if (!guessOp) {
            console.log('[PlayController] 未找到干员:', name);
            return;
        }

        // 从 Model 取出本局目标干员（答案）。如果目标未初始化，说明游戏状态不完整，此时不应继续 verify
        const targetOp = this.model.state.targetOperator;
        if (!targetOp) {
            console.warn('[PlayController] 目标干员未设置，无法执行 verify');
            return;
        }

        // 先清空输入框：避免用户在动画/网络（若未来接入）期间重复提交同一个输入造成困扰
        this.view.clearInput();

        // 触发 View 层对“本次猜测行”的确认渲染：
        // - 通常会把这一行从“可编辑/预览态”变成“已确认态”
        // - 同时根据 guessOp 与 targetOp 的差异渲染命中/未命中效果
        // - 返回 confirmedRow 以便胜利时做高亮/标记
        const confirmedRow = this.view.confirmGuessRow(guessOp, targetOp);

        // 写入历史：保持不可变更新（拷贝旧数组再追加），便于状态回溯/调试
        // 记录 name（用于展示/兼容输入不规范）与 data（本次猜测的完整干员数据）
        const nextHistory = [...this.model.state.guessHistory, { name: guessOp.name || name, data: guessOp }];
        // 胜利判定：以“干员名称完全相等”为准（与数据源一致时最可靠）
        const isVictory = guessOp.name === targetOp.name;

        // 计算已使用次数与上限配置，用于失败结算与是否允许继续猜
        const attemptsUsed = nextHistory.length;
        const maxAttempts = this.model.state.maxAttempts;
        // limited 表示“开启次数限制”：maxAttempts 必须是正的有限数字
        const limited = typeof maxAttempts === 'number' && Number.isFinite(maxAttempts) && maxAttempts > 0;

        // 从现有状态读出“是否已耗尽次数”，并在本次结算中计算新的终局/展示策略
        let attemptsExhausted = !!this.model.state.attemptsExhausted;
        // shouldShowAnswer：当次数耗尽时是否允许展示“查看答案”入口（由配置决定）
        let shouldShowAnswer = false;
        // shouldEndGame：是否将 gameOver 置为 true（胜利必结束；失败是否结束取决于次数限制与配置）
        let shouldEndGame = isVictory;

        // 非胜利且开启次数限制时，检查本次提交后是否达到/超过上限
        if (!isVictory && limited) {
            const nowExhausted = attemptsUsed >= maxAttempts;
            if (nowExhausted) {
                // 标记次数耗尽
                attemptsExhausted = true;
                // 由配置决定是否允许在耗尽后展示答案入口
                shouldShowAnswer = !!this.model.state.allowRevealAnswerAfterAttemptsExhausted;
                // 由配置决定耗尽后是否还能继续猜；不能继续则直接结束游戏
                if (!this.model.state.allowGuessAfterAttemptsExhausted) {
                    shouldEndGame = true;
                }
            }
        }

        // 提示系统：到达指定尝试次数后，自动揭示提示（例如职业/位置）
        let hintShown = !!this.model.state.hintShown;
        const hintAt = this.model.state.hintRevealAfterAttempt;
        if (!isVictory && !hintShown && hintAt != null && Number.isFinite(hintAt) && attemptsUsed >= hintAt) {
            // 生成提示文本：如果目标数据不足以生成有效提示，则不展示且不标记已展示
            const hintText = this.buildHintText(targetOp);
            if (hintText) {
                // 标记提示已展示，避免每次 confirm 都重复 setHint
                hintShown = true;
                // 交给 View 展示提示；第二个参数 true 表示“本次调用应立即显示/强调”（具体语义由 View 决定）
                this.view.setHint(hintText, true);
            }
        }

        // 将本次结算结果写回 Model：
        // - guessHistory：历史追加
        // - gameOver / isVictory：终局状态
        // - attemptsExhausted：次数耗尽状态
        // - hintShown：提示已展示状态（用于下次点击保持一致）
        this.model.patch({
            guessHistory: nextHistory,
            gameOver: shouldEndGame,
            isVictory,
            attemptsExhausted,
            hintShown,
        });

        // 更新与“次数限制”相关的 UI：是否显示“查看答案”、是否禁用继续猜测控件
        if (!isVictory && limited) {
            const exhaustedNow = attemptsUsed >= maxAttempts;
            // 仅当“确实耗尽”且“允许展示答案入口”时显示按钮/入口
            this.view.setShowAnswerVisible(exhaustedNow && shouldShowAnswer);
            // 耗尽且不允许继续猜时，直接禁用输入与确认等交互控件
            if (exhaustedNow && !this.model.state.allowGuessAfterAttemptsExhausted) {
                this.view.setGuessControlsDisabled(true);
            }
        }

        // 胜利分支：标记胜利行、隐藏答案入口、禁用继续猜测控件
        if (isVictory) {
            this.view.markVictoryRow(confirmedRow);
            this.view.setShowAnswerVisible(false);
            this.view.setGuessControlsDisabled(true);
            if (typeof window.playVictoryRibbonEffect === 'function') {
                window.playVictoryRibbonEffect();
            }
            if (typeof window.showFireworks === 'function') {
                window.showFireworks();
            }
            console.log('[PlayController] 猜对了:', guessOp.name);
        }

        // 调试日志：记录本次确认的猜测（无论胜负），便于排查数据映射与交互流程问题
        console.log('[PlayController] 确认猜测:', guessOp.name);
    }

    /** 构建提示文本 */
    buildHintText(targetOp) {
        // 提示文本构建：只从 targetOp 中抽取“不会直接暴露答案”的信息（例如职业/位置）
        // 这里保持纯函数特性：不读写 Model/View，仅基于入参生成字符串，便于复用与测试
        if (!targetOp) return '';
        const p = targetOp.profession ? `职业：${targetOp.profession}` : '';
        const pos = targetOp.position ? `位置：${targetOp.position}` : '';
        const parts = [p, pos].filter(Boolean);
        if (parts.length === 0) return '';
        return `提示：${parts.join('，')}`;
    }

    /** 绑定查看答案按钮 */
    bindShowAnswer() {
        // “查看答案”按钮绑定：避免重复绑定（使用 dataset.bound 标记），防止多次 init 导致重复弹窗/重复 patch
        const btn = this.view?.els?.btnShowAnswer || document.getElementById('btn-show-answer');
        if (!btn) return;
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', (evt) => {
            evt.preventDefault();
            // 从 Model 读取答案：View 不应直接持有答案状态，避免逻辑散落在 UI 层
            const target = this.model.state.targetOperator;
            if (!target) return;
            alert(`正确答案是：${target.name || this.model.state.targetOperatorName}`);
            // 用户主动查看答案属于“结束游戏”的一种：写回 Model 并禁用交互
            this.model.patch({ gameOver: true });
            this.view.setGuessControlsDisabled(true);
        });
    }
}

/**
 * 初始化 Play Controller
 * - 这里将实例挂到 window，方便调试与后续模块互相访问（与 Refactor/App 模块一致）
 */
function initPlayController() {
    // 入口函数：创建 MVC 三件套并初始化。挂到 window 是为了在非模块化环境中跨文件访问与调试
    const model = new window.ArkdlePlayModel();
    const view = new window.ArkdlePlayView(document);
    const controller = new PlayController(model, view);
    controller.init();

    // 保存全局引用
    // 注意：全局挂载会增加耦合度，但在当前 Refactor 结构中可降低集成成本；后续模块化可改为 ES Module 导出
    window.ArkdlePlayController = controller;
    window.ArkdlePlayModel = model;
    window.ArkdlePlayView = view;

    console.log('[Play] MVC Play Controller 初始化完成');
}

// 导出全局访问
window.initPlayController = initPlayController;
