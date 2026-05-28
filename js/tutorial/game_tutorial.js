// 教程功能模块
/** 上次打开站点的时间戳（ms），用于判断「连续多久未访问」 */
const TUTORIAL_LAST_OPEN_KEY = 'arkdle_last_open_timestamp';
/** 超过该间隔未打开则再次自动弹出教程（30 天） */
const TUTORIAL_RESHOW_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

class TutorialManager {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.isOpen = false;
        
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.modal = document.getElementById('teaching');
        this.openBtn = document.getElementById('tool-tutorial');
        this.closeBtn = document.getElementById('close-teaching');
        this.prevBtn = document.getElementById('prev-step');
        this.nextBtn = document.getElementById('next-step');
        this.startBtn = document.getElementById('start-game');
        
        this.steps = document.querySelectorAll('.tutorial-step');
        this.stepDots = document.querySelectorAll('.step-dot');
    }

    bindEvents() {
        // 打开教程
        if (this.openBtn) {
            this.openBtn.addEventListener('click', () => this.open());
        }

        // 关闭教程
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        // 点击背景关闭
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // 导航按钮
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.prevStep());
        }
        
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.nextStep());
        }

        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.close());
        }

        // 步骤指示器点击
        this.stepDots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.goToStep(index + 1));
        });
    }

    open() {
        if (this.modal) {
            this.isOpen = true;
            this.modal.style.display = 'flex';
            // 使用 setTimeout 确保 display 属性生效后再添加 show 类
            setTimeout(() => {
                this.modal.classList.add('show');
            }, 10);
            
            // 重置到第一步
            this.goToStep(1);
            
            // 防止页面滚动
            document.body.style.overflow = 'hidden';
        }
    }

    close() {
        if (this.modal) {
            this.isOpen = false;
            this.modal.classList.remove('show');
            
            // 等待动画完成后隐藏元素
            setTimeout(() => {
                this.modal.style.display = 'none';
            }, 300);
            
            // 恢复页面滚动
            document.body.style.overflow = '';
        }
    }

    goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > this.totalSteps) {
            return;
        }

        this.currentStep = stepNumber;
        this.updateStepDisplay();
        this.updateNavigation();
    }

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            this.goToStep(this.currentStep + 1);
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.goToStep(this.currentStep - 1);
        }
    }

    updateStepDisplay() {
        // 更新步骤内容显示
        this.steps.forEach((step, index) => {
            const stepNumber = index + 1;
            if (stepNumber === this.currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        // 更新步骤指示器
        this.stepDots.forEach((dot, index) => {
            const stepNumber = index + 1;
            if (stepNumber === this.currentStep) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    updateNavigation() {
        // 更新上一步按钮
        if (this.prevBtn) {
            this.prevBtn.disabled = this.currentStep === 1;
        }

        // 更新下一步/开始游戏按钮
        if (this.currentStep === this.totalSteps) {
            if (this.nextBtn) {
                this.nextBtn.style.display = 'none';
            }
            if (this.startBtn) {
                this.startBtn.style.display = 'block';
            }
        } else {
            if (this.nextBtn) {
                this.nextBtn.style.display = 'block';
            }
            if (this.startBtn) {
                this.startBtn.style.display = 'none';
            }
        }
    }

    /**
     * 首次访问、或连续超过 30 天未打开站点时自动弹出教程。
     * 每次进入页面都会更新「上次打开」时间戳（供下次访问比较）。
     */
    checkFirstVisit() {
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

        if (shouldAutoShow) {
            console.log('将自动显示教程（首次访问，或已超过 30 天未打开）');
            setTimeout(() => {
                this.open();
                try {
                    localStorage.setItem('arkdle_tutorial_shown', 'true');
                    if (!localStorage.getItem('arkdle_first_visit_time')) {
                        localStorage.setItem('arkdle_first_visit_time', String(now));
                    }
                } catch (e) {
                    console.warn('[教程] 无法写入教程状态:', e);
                }
            }, 1500);
        } else {
            console.log('跳过自动显示教程（近期已访问）');
        }
    }

    // 重置教程状态（用于测试或重新显示教程）
    resetTutorialStatus() {
        localStorage.removeItem('arkdle_tutorial_shown');
        localStorage.removeItem('arkdle_first_visit_time');
        localStorage.removeItem(TUTORIAL_LAST_OPEN_KEY);
        console.log('教程状态已重置');
    }
}

// 初始化教程管理器
let tutorialManager;

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    tutorialManager = new TutorialManager();
    
    // 首次访问自动显示教程
    tutorialManager.checkFirstVisit();
});

// 全局函数：重置教程状态（用于测试）
window.resetTutorial = function() {
    if (tutorialManager) {
        tutorialManager.resetTutorialStatus();
        alert('教程状态已重置！刷新页面后将重新显示教程。');
    }
};

// 全局函数：手动打开教程
window.openTutorial = function() {
    if (tutorialManager) {
        tutorialManager.open();
    }
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TutorialManager;
}