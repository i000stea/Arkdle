// 编辑模式功能模块
// 当URL包含?edit参数时启用的开发者功能

/**
 * 初始化编辑模式
 */
function initEditMode() {
    console.log('[编辑模式] 初始化编辑模式');

    // 清除当前页面缓存
    localStorage.removeItem('arkdle_beforeGuessing_cache');
    localStorage.removeItem('arkdle_beforeGuessing_cache_random');
    localStorage.removeItem('arkdle_cached_config_version');
    console.log('[编辑模式] 已清除页面缓存与配置版本记录');

    // 设置editinfo内容
    const editinfo = document.getElementById('editinfo');
    if (editinfo) {
        editinfo.textContent = '调试模式，无缓存';
    }

    // 创建固定在左下角的刷新按钮
    createRefreshButton();
}

/**
 * 创建刷新按钮
 */
function createRefreshButton() {
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'refresh-btn';
    refreshBtn.textContent = '刷新';
    refreshBtn.style.cssText = `
        position: fixed;
        bottom: 40px;
        left: 20px;
        padding: 8px 16px;
        font-size: 0.8rem;
        background: #45c1f7;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 2px 8px #00000033;
        transition: all 0.2s ease;
    `;

    // 添加悬停效果
    refreshBtn.addEventListener('mouseenter', () => {
        refreshBtn.style.background = '#3a7ad9';
        refreshBtn.style.transform = 'translateY(-2px)';
    });

    refreshBtn.addEventListener('mouseleave', () => {
        refreshBtn.style.background = '#45c1f7';
        refreshBtn.style.transform = 'translateY(0)';
    });

    // 添加点击事件
    refreshBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.reload(true);
    });

    // 将按钮添加到页面
    document.body.appendChild(refreshBtn);

    console.log('[编辑模式] 刷新按钮已创建');
}

/**
 * 检查是否应该启用编辑模式
 * @returns {boolean} 是否启用编辑模式
 */
function shouldEnableEditMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('edit');
}

// 如果当前页面应该启用编辑模式，则自动初始化
if (shouldEnableEditMode()) {
    // 确保DOM加载完成后再初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEditMode);
    } else {
        initEditMode();
    }
}