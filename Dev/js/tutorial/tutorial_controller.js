(function () {
    'use strict';

    /**
     * 教程功能Controller层 - 协调层
     * 
     * 设计理念：
     * - 采用MVC架构中的Controller角色，负责协调Model和View之间的数据流
     * - Controller是唯一知道Model和View的"中介"，但二者之间不直接通信
     * - 所有用户交互事件由Controller接收，转换为Model状态变更
     * 
     * 架构原则：
     * 1. 事件绑定集中在init()方法中，便于查看所有交互入口
     * 2. UI事件处理只更新Model状态，不直接操作DOM
     * 3. Model变化通过事件通知Controller，再由Controller调用View方法
     * 4. 保持Controller"瘦"，复杂逻辑应该下移到Model或上移到全局事件
     * 
     * 参考原版：
     * - 迁移自 js/tutorial/game_tutorial.js 中的 TutorialManager 类
     * - 将UI事件处理和状态管理分离，符合MVC职责划分
     */
    class TutorialController {
        constructor(model, view) {
            // 持有Model和View的引用，是二者的协调者
            this.model = model;
            this.view = view;
            this._bound = false;
        }

        /**
         * 初始化教程控制器
         * 
         * 执行流程：
         * 1. 订阅Model的change事件，监听状态变更
         * 2. 根据变更类型调用相应的View方法
         * 3. 绑定所有UI交互事件（按钮、键盘等）
         * 4. 检查是否需要自动显示教程
         * 
         * 注意事项：
         * - 使用_flag防止重复初始化，保证单例模式
         * - 在change事件中通过changedKeys判断变更类型，实现精确渲染
         */
        init() {
            if (this._bound) return;
            this._bound = true;

            // 订阅Model变化事件
            // 当Model.state中的任何字段发生变化，都会触发这里的回调
            this.model.addEventListener('change', (evt) => {
                const state = evt.detail?.state;
                if (!state) return;

                // 只在visible字段变化时处理显示/隐藏逻辑
                // 这样可以避免在currentStep变化时重复触发显示
                if (evt.detail.changedKeys.includes('visible')) {
                    if (state.visible) {
                        // 显示教程时，只需调用View.show()即可
                        // 教程内容现在全显示，不再需要步骤切换
                        this.view.show();
                    } else if (!state.visible && this.view.els.modal?.classList.contains('show')) {
                        this.view.hide();
                    }
                }
            });

            // 绑定所有用户交互事件
            this.bindOpenButton();
            this.bindCloseButton();
            this.bindModalClick();
            this.bindEscapeKey();
            
            // 检查是否需要自动弹出教程
            this.checkAutoShow();
        }

        /**
         * 绑定教程打开按钮事件
         * 
         * 当用户点击工具栏的教程按钮时：
         * - 设置visible=true显示教程
         * - 重置currentStep=1从头开始
         * 
         * 这些状态变更会通过Model的change事件通知View
         */
        bindOpenButton() {
            const btn = this.view.els.openBtn;
            if (!btn) return;

            btn.addEventListener('click', () => {
                this.model.open();
            });
        }

        /**
         * 绑定教程关闭按钮事件
         * 
         * 关闭教程有两个操作：
         * 1. 设置visible=false隐藏教程（Model负责）
         * 2. 在localStorage中标记教程已显示（Model负责）
         * 
         * 这样在30天内用户不会再次自动看到教程
         */
        bindCloseButton() {
            const btn = this.view.els.closeBtn;
            if (!btn) return;

            btn.addEventListener('click', () => {
                this.model.close();
                this.model.markTutorialShown();
            });
        }

        /**
         * 绑定模态框背景点击事件
         * 
         * 当用户点击教程弹窗背景时关闭教程，提供更好的用户体验
         */
        bindModalClick() {
            this.view.bindModalClick(() => {
                this.model.close();
                this.model.markTutorialShown();
            });
        }

        /**
         * 绑定ESC键关闭教程
         * 
         * 提升用户体验：
         * - 用户可以随时按ESC键关闭教程
         * - 只在教程可见时响应，避免干扰其他功能
         * 
         * 与关闭按钮行为一致：隐藏教程并标记已显示
         */
        bindEscapeKey() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.model.state.visible) {
                    this.model.close();
                    this.model.markTutorialShown();
                }
            });
        }

        /**
         * 检查并自动显示教程
         * 
         * 自动显示逻辑：
         * 1. 调用Model.shouldAutoShow()判断是否需要自动弹出
         * 2. 如果需要，通过setTimeout延迟1.5秒显示
         * 3. 延迟是为了让页面其他元素先完成初始化
         * 4. 同时标记教程已显示，避免短时间内重复弹出
         * 
         * 延迟显示的考虑：
         * - 给用户时间看到页面内容
         * - 避免与其他启动动画冲突
         * - 提供更好的首次访问体验
         */
        checkAutoShow() {
            if (this.model.shouldAutoShow()) {
                console.log('将自动显示教程（首次访问，或已超过 30 天未打开）');
                setTimeout(() => {
                    this.model.open();
                    this.model.markTutorialShown();
                }, 1500);
            } else {
                console.log('跳过自动显示教程（近期已访问）');
            }
        }

        /**
         * 重置教程状态
         * 
         * 主要用于测试场景：
         * - 开发人员可以调用此方法重置教程显示状态
         * - 方便测试首次访问流程
         * - 也可用于用户需要重新查看教程
         */
        resetTutorialStatus() {
            this.model.resetTutorialStatus();
        }
    }

    /**
     * 初始化教程模块的入口函数
     * 
     * 执行流程：
     * 1. 创建Model实例（状态容器）
     * 2. 创建View实例（DOM视图）
     * 3. 创建Controller实例（协调层）
     * 4. 调用Controller.init()完成初始化
     * 5. 挂载到window供全局访问（用于测试和手动调用）
     * 
     * 这种"创建三件套然后初始化"的模式是Dev目录下的标准做法
     * 便于 main.js 中的动态加载和按需初始化
     */
    function initTutorial() {
        const model = new window.ArkdleTutorialModel();
        const view = new window.ArkdleTutorialView();
        const controller = new TutorialController(model, view);
        controller.init();
        
        // 挂载到window方便调试和外部调用
        window.arkdleTutorialController = controller;
        window.arkdleTutorialModel = model;
    }

    window.initTutorial = initTutorial;

    /**
     * 全局函数：重置教程状态（用于测试）
     * 
     * 由Controller暴露给全局，用于开发调试
     * 用户（或开发者）可以在浏览器控制台调用 window.resetTutorial()
     * 
     * 注意：这是一种"暴露调试接口"的模式
     * 生产环境也保留，用于用户需要重新查看教程的场景
     */
    window.resetTutorial = function() {
        if (window.arkdleTutorialController) {
            window.arkdleTutorialController.resetTutorialStatus();
            alert('教程状态已重置！刷新页面后将重新显示教程。');
        }
    };

    /**
     * 全局函数：手动打开教程
     * 
     * 由Model暴露给全局，允许外部直接打开教程
     * 保持与原版 game_tutorial.js 的兼容性
     * 
     * 使用场景：
     * - 用户点击工具栏按钮
     * - 其他模块需要引导用户查看教程
     */
    window.openTutorial = function() {
        if (window.arkdleTutorialModel) {
            window.arkdleTutorialModel.open();
        }
    };
})();