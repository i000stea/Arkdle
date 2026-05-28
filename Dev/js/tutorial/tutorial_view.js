(function () {
    'use strict';

    /**
     * 教程功能View层 - DOM视图
     * 
     * 设计理念：
     * - 采用MVC架构中的View角色，负责DOM渲染和用户界面更新
     * - View层"哑巴"化设计：不包含业务逻辑，只接收Controller的指令进行渲染
     * - 所有样式和动画逻辑都封装在View中，Controller不需要了解DOM细节
     * 
     * 架构优势：
     * 1. 视图逻辑集中：所有DOM操作都在此处，便于维护和修改样式
     * 2. 业务解耦：View不知道为什么需要渲染，只知道如何渲染
     * 3. 可测试性：可以通过mock DOM元素来测试渲染逻辑
     * 4. 可扩展性：如果需要替换UI框架（如React/Vue），只需重写此层
     */
    class TutorialView {
        constructor(root = document) {
            // 接收root参数（默认为document），便于单元测试时传入mock文档
            this.root = root;
            
            // 缓存DOM元素引用，避免重复查询DOM带来的性能开销
            // 遵循"查询一次，使用多次"的性能优化原则
            this.els = {
                modal: root.getElementById('teaching'),
                openBtn: root.getElementById('tool-tutorial'),
                closeBtn: root.getElementById('close-teaching'),
            };
            this._bound = false;
        }

        /**
         * 隐藏教程模态框
         * 
         * 实现动画过渡的关键：
         * 1. 移除'show'类触发CSS过渡动画（淡出效果）
         * 2. 使用setTimeout延迟300ms后设置display:none，等待动画完成
         * 3. 恢复body滚动，允许用户正常滚动页面
         * 
         * 注意：这里的300ms需要与CSS中的过渡时间保持一致
         */
        hide() {
            const modal = this.els.modal;
            if (!modal) return;
            modal.classList.remove('show');
            // 使用setTimeout确保动画完成后再隐藏元素
            // 否则动画会因为元素隐藏而立即中断
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
            document.body.style.overflow = '';
        }

        /**
         * 显示教程模态框
         * 
         * 实现动画过渡的关键：
         * 1. 先设置display:flex让元素可见（但不添加show类）
         * 2. 使用setTimeout确保display属性生效后再添加show类
         * 3. 添加'show'类触发CSS过渡动画（淡入效果）
         * 4. 设置body overflow:hidden 防止背景滚动
         * 
         * setTimeout的10ms延迟是必要的，因为浏览器需要一个事件循环
         * 来应用display属性的变化，然后才能触发过渡动画
         */
        show() {
            const modal = this.els.modal;
            if (!modal) return;
            modal.style.display = 'flex';
            // 确保display属性生效后再添加show类，触发CSS过渡动画
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            document.body.style.overflow = 'hidden';
        }

        /**
         * 绑定模态框点击事件
         * 
         * 当用户点击模态框背景时关闭教程，提供更好的用户体验
         * 使用防重复绑定（_bound标志）确保同一View实例只绑定一次
         * 
         * @param {Function} callback - 点击背景时的回调函数
         */
        bindModalClick(callback) {
            const modal = this.els.modal;
            if (!modal) return;

            const handler = (e) => {
                // 只在点击背景（modal本身）时触发，不包括内容区域
                if (e.target === modal) {
                    callback();
                }
            };

            if (!this._bound) {
                modal.addEventListener('click', handler);
                this._bound = true;
            }
        }
    }

    // 挂载到全局window对象，供Controller使用
    // 遵循Dev目录中其他模块的命名约束：Arkdle前缀避免全局污染
    window.ArkdleTutorialView = TutorialView;
})();