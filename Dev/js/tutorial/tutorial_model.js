(function () {
    'use strict';

    /**
     * 教程功能Model层 - 状态容器
     * 
     * 设计理念：
     * - 采用MVC架构中的Model角色，作为教程功能的"唯一真相来源"（Single Source of Truth）
     * - 通过继承EventTarget实现观察者模式，当状态变化时通知所有订阅者
     * - 借鉴QFramework的设计思想：Model只负责数据和业务逻辑，不依赖具体的视图实现
     * 
     * 架构优势：
     * 1. 状态集中管理：所有教程相关状态（当前步骤、可见性、总步数）都在此处统一定义
     * 2. 响应式更新：通过CustomEvent的change事件，Controller和View可以监听状态变化
     * 3. 可测试性：Model层完全独立，不依赖DOM，可以编写单元测试来验证状态变更逻辑
     * 4. 可复用性：多个View可以监听同一个Model，实现多端同步显示
     */

    // 本地存储键名，用于记录用户上次打开站点的时间戳
    // 实现"30天未访问自动再显示教程"的功能
    const TUTORIAL_LAST_OPEN_KEY = 'arkdle_last_open_timestamp';
    
    // 30天的毫秒数，用于判断是否应该自动显示教程
    // 如果用户超过30天未访问，说明可能忘记了游戏规则，再次自动弹出教程
    const TUTORIAL_RESHOW_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

    /**
     * TutorialModel类 - 教程状态管理类
     * 
     * 状态字段说明：
     * - currentStep: 当前显示的步骤编号（1-4）
     * - totalSteps: 教程总步数（固定为4）
     * - visible: 教程模态框是否可见
     * - ready: 教程数据是否就绪（预留字段，方便后续扩展异步教程数据加载）
     */
    class TutorialModel extends EventTarget {
        constructor() {
            super();
            // 初始化默认状态
            this.state = {
                currentStep: 1,
                totalSteps: 4,
                visible: false,
                ready: true,
            };
        }

        /**
         * 更新状态的核心方法
         * 
         * 设计要点：
         * 1. 执行浅合并，将传入的部分状态与当前状态合并
         * 2. 计算changedKeys，只派发真正变化的字段，避免无意义的重渲染
         * 3. 如果没有字段变化，直接返回不派发事件，提高性能
         * 
         * 事件协议：
         * - type: 'change'
         * - detail.changedKeys: 发生变化的字段名数组
         * - detail.state: 更新后的完整状态对象
         * 
         * @param {Partial<TutorialModel['state']>} nextPartialState - 需要更新的字段
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

        /**
         * 跳转到指定步骤
         * 
         * 边界检查：确保步骤编号在有效范围内（1-totalSteps）
         * 这样可以防止Controller传入无效值导致UI异常
         * 
         * @param {number} stepNumber - 目标步骤编号
         */
        goToStep(stepNumber) {
            if (stepNumber < 1 || stepNumber > this.state.totalSteps) return;
            this.patch({ currentStep: stepNumber });
        }

        /**
         * 切换到下一步
         * 
         * 在到达最后一步时自动停止，防止越界
         * 使用patch方法驱动View更新，保持MVC数据流一致性
         */
        nextStep() {
            if (this.state.currentStep < this.state.totalSteps) {
                this.patch({ currentStep: this.state.currentStep + 1 });
            }
        }

        /**
         * 切换到上一步
         * 
         * 在到达第一步时自动停止，防止越界
         * 配合View的prevBtn.disabled状态控制
         */
        prevStep() {
            if (this.state.currentStep > 1) {
                this.patch({ currentStep: this.state.currentStep - 1 });
            }
        }

        /**
         * 打开教程模态框
         * 
         * 设计决策：打开时重置到第一步
         * 原因是用户可能在不同步骤关闭教程，再次打开时应该从头开始
         */
        open() {
            this.patch({ visible: true, currentStep: 1 });
        }

        /**
         * 关闭教程模态框
         * 
         * 只需要设置visible=false，视图层负责处理动画和样式
         * 这样做可以保持动画逻辑在View层，符合MVC职责分离原则
         */
        close() {
            this.patch({ visible: false });
        }

        /**
         * 判断是否应该自动显示教程
         * 
         * 逻辑流程：
         * 1. 检查是否存在上次访问时间戳
         * 2. 如果存在且在30天内，返回false（不要自动显示）
         * 3. 如果存在但超过30天，返回true（需要显示）
         * 4. 如果不存在，检查旧版标记（向后兼容）
         * 5. 更新当前访问时间戳到localStorage
         * 
         * 返回值：boolean - 是否应该自动弹出教程
         */
        shouldAutoShow() {
            const now = Date.now();
            const lastOpenStr = localStorage.getItem(TUTORIAL_LAST_OPEN_KEY);
            let shouldAutoShow = false;

            if (lastOpenStr) {
                const lastOpen = parseInt(lastOpenStr, 10);
                if (Number.isFinite(lastOpen) && now - lastOpen <= TUTORIAL_RESHOW_AFTER_MS) {
                    shouldAutoShow = false;
                } else {
                    shouldAutoShow = true;
                }
            } else {
                const legacyShown = localStorage.getItem('arkdle_tutorial_shown');
                shouldAutoShow = !legacyShown;
            }

            try {
                localStorage.setItem(TUTORIAL_LAST_OPEN_KEY, String(now));
            } catch (e) {
                console.warn('[教程] 无法写入访问时间:', e);
            }

            return shouldAutoShow;
        }

        /**
         * 标记教程已显示
         * 
         * 存储两个标记：
         * 1. arkdle_tutorial_shown: 标记教程已展示过，30天内不再自动弹出
         * 2. arkdle_first_visit_time: 记录首次访问时间，用于统计用户数据
         */
        markTutorialShown() {
            try {
                localStorage.setItem('arkdle_tutorial_shown', 'true');
                if (!localStorage.getItem('arkdle_first_visit_time')) {
                    localStorage.setItem('arkdle_first_visit_time', String(Date.now()));
                }
            } catch (e) {
                console.warn('[教程] 无法写入教程状态:', e);
            }
        }

        /**
         * 重置教程状态
         * 
         * 主要用于测试场景，或允许用户重新查看教程
         * 从localStorage中移除所有教程相关标记
         */
        resetTutorialStatus() {
            localStorage.removeItem('arkdle_tutorial_shown');
            localStorage.removeItem('arkdle_first_visit_time');
            localStorage.removeItem(TUTORIAL_LAST_OPEN_KEY);
            console.log('教程状态已重置');
        }
    }

    // 挂载到全局window对象，供其他模块使用
    // 遵循Dev目录中其他模块的命名约束：Arkdle前缀避免全局污染
    window.ArkdleTutorialModel = TutorialModel;
})();