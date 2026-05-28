/**
 * MVC 入口 - App 模块
 * 
 * 职责：作为 MVC 的最外层，负责将页面 DOM 映射为 View，
 * 用 Model 管理状态，用 Controller 处理 UI 交互并抛出业务事件。
 * 
 * 模块划分（MVC 三层）
 * - AppModel   : 状态容器，继承 EventTarget，内部 patch 更新 + dispatch change
 * - AppView    : DOM 引用集中管理，对外提供 setXXX 命令式 API
 * - AppController : 绑定所有事件 → 调用 model.patch + dispatch 自定义事件
 * 
 * 关键设计
 * - Controller 不直接操作 DOM，而是通过 View 的命令式方法
 * - UI 交互统一转为 window CustomEvent（arkdle:ui:*），
 *   业务 System/Service 订阅这些事件，保持单向依赖
 * - 数据加载：启动时通过 DataManager 加载干员数据，
 *   版本号一致时使用本地缓存，减少云端消耗
 */

// 工具：等待 DOM 就绪
const domReady = (fn) => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        fn();
    }
};

// ============================================================
// 数据管理集成：启动时加载数据
// ============================================================

/**
 * 启动数据加载流程
 * 1. 优先尝试从 DataManager 加载（带版本检查）
 * 2. 如果失败，尝试仅使用本地缓存
 * 3. 加载完成后将 operatorsData 挂载到 window 供其他模块使用
 */
const initDataLoader = async () => {
    const dataManager = window.ArkdleDataManager;
    if (!dataManager) {
        console.warn('[App] DataManager 未加载，跳过数据初始化');
        return;
    }

    try {
        // 尝试加载数据（带版本检查和云端请求）
        await dataManager.loadData();

        if (dataManager.state.operatorsData) {
            window.operatorsData = dataManager.state.operatorsData;
            console.log('[App] 干员数据已就绪，共', Object.keys(window.operatorsData).length, '个干员');
        }
        if (dataManager.state.fuzzyItemData) {
            window.fuzzyItemData = dataManager.state.fuzzyItemData;
        }
    } catch (error) {
        console.warn('[App] 数据加载失败，尝试使用本地缓存:', error);

        dataManager.loadFromCacheOnly();

        if (dataManager.state.operatorsData) {
            window.operatorsData = dataManager.state.operatorsData;
            console.log('[App] 使用本地缓存数据，共', Object.keys(window.operatorsData).length, '个干员');
        } else {
            console.error('[App] 本地也无缓存数据');
        }
        if (dataManager.state.fuzzyItemData) {
            window.fuzzyItemData = dataManager.state.fuzzyItemData;
        }
    }
};

// ============================================================
// Model 层：状态容器 + 变更通知
// ============================================================
class AppModel extends EventTarget {
    constructor() {
        super();
        // 初始状态
        this.state = {
            inputName: '',           // 当前输入框内容
            rabbitModeEnabled: true, // 兔头模式开关
        };
    }

    /**
     * 部分更新状态
     * @param {Partial<AppModel['state']>} nextPartialState  部分状态
     * 
     * 1. 浅合并新状态
     * 2. 对比 changedKeys
     * 3. 有变化则 dispatch 'change' 事件
     */
    patch(nextPartialState) {
        const next = { ...this.state, ...nextPartialState };
        const changedKeys = Object.keys(nextPartialState)
            .filter((k) => next[k] !== this.state[k]);
        if (changedKeys.length === 0) return;
        this.state = next;
        this.dispatchEvent(new CustomEvent('change', {
            detail: { changedKeys, state: this.state }
        }));
    }
}

// ============================================================
// View 层：DOM 引用集中 + 命令式更新方法
// ============================================================
class AppView {
    constructor(root = document) {
        this.root = root;
        // 一次性收集所有需要操作的 DOM 元素
        this.els = {
            inputName: root.getElementById('input-name'),
            btnConfirm: root.getElementById('btn-confirm'),
            btnRandomSelect: root.getElementById('btn-random-select'),
            btnRabbitMode: root.getElementById('btn-rabbit-mode'),
            btnShowAnswer: root.getElementById('btn-show-answer'),
            btnDailyScreenshotShare: root.getElementById('btn-daily-screenshot-share'),
            btnRandomTopic: root.getElementById('btn-random-topic'),
            btnChangelog: root.getElementById('btn-changelog'),
            toolTutorial: root.getElementById('tool-tutorial'),
            modalTeaching: root.getElementById('teaching'),
            btnCloseTeaching: root.getElementById('close-teaching'),
            btnPrevStep: root.getElementById('prev-step'),
            btnNextStep: root.getElementById('btn-next-step'),
            btnStartGame: root.getElementById('btn-start-game'),
            suggestionsContainer: root.getElementById('suggestions-container'),
        };
    }

    /** 设置兔头模式按钮的 aria-pressed */
    setRabbitModeEnabled(enabled) {
        const btn = this.els.btnRabbitMode;
        if (btn) btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }

    /** 显示/隐藏教程弹窗 */
    setTeachingVisible(visible) {
        const modal = this.els.modalTeaching;
        if (!modal) return;
        modal.style.display = visible ? '' : 'none';
    }

    /** 命令式设置输入框的值（不触发 input 事件） */
    setInputName(value) {
        const input = this.els.inputName;
        if (!input) return;
        if (input.value !== value) input.value = value;
    }
}

// ============================================================
// Controller 层：事件绑定 + 业务转发
// ============================================================
class AppController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
    }

    /** 初始化：绑定所有事件 */
    init() {
        this.bindInputs();
        this.bindSuggestions();

        // 订阅 Model 变化，同步 View
        this.model.addEventListener('change', (evt) => {
            const state = evt.detail?.state;
            if (!state) return;
            this.view.setRabbitModeEnabled(!!state.rabbitModeEnabled);
        });

        // 初始化 View
        this.view.setRabbitModeEnabled(!!this.model.state.rabbitModeEnabled);
    }

    // ---- 输入框 ----
    bindInputs() {
        const input = this.view.els.inputName;
        if (!input) return;

        // 输入事件 → 更新 model
        input.addEventListener('input', () => {
            this.model.patch({ inputName: input.value });
        });

        input.addEventListener('keydown', (evt) => {
            if (evt.key !== 'Enter') return;
            if (evt.defaultPrevented) return;
            evt.preventDefault();
            window.dispatchEvent(new CustomEvent('arkdle:ui:preview', {
                detail: { name: this.model.state.inputName }
            }));
        });
    }

    // ---- 建议列表点击 ----
    bindSuggestions() {
        const container = this.view.els.suggestionsContainer;
        if (!container) return;
        container.addEventListener('click', (evt) => {
            const target = evt.target instanceof Element ? evt.target : null;
            const item = target?.closest?.('[data-value]') ?? null;
            const value = item?.getAttribute?.('data-value');
            if (!value) return;
            this.model.patch({ inputName: value });
            this.view.setInputName(value);
        });
    }

    // ---- 业务方法：转为 window 事件 ----
    onConfirm() {
        window.dispatchEvent(new CustomEvent('arkdle:ui:confirm', {
            detail: { name: this.model.state.inputName }
        }));
    }
    onToggleRabbitMode() {
        const enabled = !this.model.state.rabbitModeEnabled;
        this.model.patch({ rabbitModeEnabled: enabled });
        window.dispatchEvent(new CustomEvent('arkdle:ui:toggleRabbitMode', {
            detail: { enabled }
        }));
    }
    onOpenTutorial() {
        this.view.setTeachingVisible(true);
        window.dispatchEvent(new CustomEvent('arkdle:ui:openTutorial'));
    }
    onCloseTutorial() {
        this.view.setTeachingVisible(false);
        window.dispatchEvent(new CustomEvent('arkdle:ui:closeTutorial'));
    }
    onTutorialPrev() {
        window.dispatchEvent(new CustomEvent('arkdle:ui:tutorialPrev'));
    }
    onTutorialNext() {
        window.dispatchEvent(new CustomEvent('arkdle:ui:tutorialNext'));
    }
    onTutorialStartGame() {
        this.view.setTeachingVisible(false);
        window.dispatchEvent(new CustomEvent('arkdle:ui:tutorialStartGame'));
    }
}

// ============================================================
// 启动：初始化数据 + 创建 MVC 实例
// ============================================================
domReady(async () => {
    // 1. 先加载数据
    await initDataLoader();

    // 2. 创建 MVC 实例
    const model = new AppModel();
    const view = new AppView(document);
    const controller = new AppController(model, view);
    controller.init();

    // 方便调试 / 外部扩展
    window.ArkdleRefactor = { model, view, controller };

    console.log('[App] MVC 初始化完成');
});
