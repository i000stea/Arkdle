async function loadGameScripts() {
    // 说明：这里通过"按顺序动态加载"来确保各模块的 window 导出已就绪
    // 约束：后加载的脚本可以依赖先加载脚本提供的全局符号（window.XXX）
    const scripts = [
        './js/log/log.js',
        './js/data/data_manager.js',
        './js/app/app.js',
        // UI 行为模块（对齐原版）：拖拽（推拽）滚动 guessing 区域
        '../js/ui/content_drag.js',
        // 胜利特效（对齐原版）：猜中后播放全屏彩带/烟花彩带 
        '../js/effects/victory_ribbons_effect.js',
        // 服务器模块（数据查询）
        './js/server/server.js',
        './js/server/server_controller.js',
        './js/route/route_module.js',
        './js/route/question_route.js',
        './js/route/random_route.js',
        './js/route/daily_route.js',
        './js/route/route_controller.js',
        './js/tooltip/tooltip_model.js',
        './js/tooltip/tooltip_view.js',
        './js/tooltip/tooltip_controller.js',
        './js/fuzzy/fuzzy_search_engine.js',
        './js/fuzzy/fuzzy_search_model.js',
        './js/fuzzy/fuzzy_search_view.js',
        './js/fuzzy/fuzzy_search_controller.js',
        // 教程模块（独立 MVC 模块）
        './js/tutorial/tutorial_model.js',
        './js/tutorial/tutorial_view.js',
        './js/tutorial/tutorial_controller.js',
        // Play 模块（独立 MVC 模块）
        './js/play/play_model.js',
        // guessing-items 行渲染器：PlayView 会调用它
        './js/play/guessing_item_renderer.js',
        './js/play/play_view.js',
        './js/play/play_controller.js',
    ];
    for (const src of scripts) {
        await loadScript(src);
    }

    // 初始化各模块（按需启动；不存在则跳过，便于裁剪/调试）
    if (typeof window.initPlayController !== 'undefined') {
        window.initPlayController();
    }
    if (typeof window.initTooltip !== 'undefined') {
        window.initTooltip();
    }
    if (typeof window.initFuzzySearch !== 'undefined') {
        window.initFuzzySearch();
    }
    if (typeof window.initTutorial !== 'undefined') {
        window.initTutorial();
    }

    if (!window.fuzzyItemData) {
        const dm = window.ArkdleDataManager;
        if (dm && dm.state.fuzzyItemData) {
            window.fuzzyItemData = dm.state.fuzzyItemData;
        }
    }
    const _routeModule = window.ArkdleRouteModule;
    const _resolvedRoute = _routeModule ? _routeModule.resolve(new URLSearchParams(window.location.search)) : 'daily';
    if (_resolvedRoute === 'daily' && typeof window.initServerController !== 'undefined') {
        window.initServerController();
    }
    if (typeof window.initRouteController !== 'undefined') {
        window.initRouteController();
    }

    if (typeof window.initDragFunctionality === 'function') {
        window.initDragFunctionality();
    }
}

// 动态加载依赖脚本（仅在 index.html 只加载 game_main.js 时使用）
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = false; // 保证按顺序执行
        s.onload = () => resolve(src);
        s.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
        document.head.appendChild(s);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadGameScripts());
} else {
    loadGameScripts();
}
