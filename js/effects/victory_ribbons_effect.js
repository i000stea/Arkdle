/**
 * 猜对全中时的全屏彩带：参考 test/彩带.html，从屏幕下方左右两侧以烟花角度喷出，
 * 爆发阶段后进入重力下落，结束后移除 canvas。
 *
 * ---------------------------------------------------------------------------
 * 自定义参数要改哪里？（按优先级从上到下改即可）
 *
 * 【一、文件顶部「全局」】
 *   - COLORS：粒子颜色列表（#RRGGBB）。
 *   - REF_MS：物理与时间缩放基准，一般保持 1000/60 即可；改大会让同样数字的
 *     重力/速度在体感上变慢（与帧时长归一化有关）。
 *
 * 【二、playVictoryRibbonEffect() 函数体内】
 *   A) 搜注释「二-A」：canvas.style.cssText（z-index、pointer-events 等）
 *   B) 搜「★ CONFIG：单次播放」：gravity、初速、阻力、爆发时长、stagger、粒子数；
 *      小屏减量另搜「二-M」（宽度阈值、手机粒子数/纸片尺寸）
 *   C) 搜「二-C」：生成循环里的发射高度、角度扇形、形状比例、纸片大小、自转
 *   D) 搜「二-D」：maxEffectMs（整段最长持续时间）
 *   E) 搜「二-E」：step() 内淡入/淡出、单帧 dt 上限、爆发衰减 0.99、离场 margin
 *   F) 搜「二-F」：drawParticle 里 master 乘的不透明度系数
 *
 * 对外接口：window.playVictoryRibbonEffect()，其它脚本只调这个即可。
 * ---------------------------------------------------------------------------
 */
(function victoryRibbonsIIFE() {
    let activeCanvas = null;
    let rafId = 0;
    let resizeHandler = null;

    // ========== 【一、全局】颜色表：自定义配色只改这里 ==========
    const COLORS = [
        '#f44336',
        '#e91e63',
        '#9c27b0',
        '#673ab7',
        '#3f51b5',
        '#2196f3',
        '#03a9f4',
        '#00bcd4',
        '#009688',
        '#4CAF50',
        '#8BC34A',
        '#CDDC39',
        '#FFEB3B',
        '#FFC107',
        '#FF9800',
        '#FF5722',
    ];

    /**
     * 【一、全局】物理时间基准（毫秒）。
     * 动画里用 dtNorm = 实际帧间隔 / REF_MS，把「每帧变化量」换算到接近 60fps 的手感。
     * 一般不要动；若改大（例如 1000/30），同等 gravity/velocity 会变得更「慢、轻」。
     */
    const REF_MS = 1000 / 60;

    function removeActive() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
        if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler);
            resizeHandler = null;
        }
        if (activeCanvas && activeCanvas.parentNode) {
            activeCanvas.remove();
        }
        activeCanvas = null;
    }

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    /**
     * 播放一次胜利彩带（可重复调用，会打断上一次）。
     */
    function playVictoryRibbonEffect() {
        removeActive();

        const canvas = document.createElement('canvas');
        canvas.className = 'victory-ribbon-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        // 【二-A】画布层叠：改 z-index / 是否穿透点击 等，只改这一行字符串
        canvas.style.cssText =
            'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:10050;';
        document.body.appendChild(canvas);
        activeCanvas = canvas;

        const ctx = canvas.getContext('2d');
        let W = 0;
        let H = 0;
        let dpr = 1;

        function fit() {
            W = window.innerWidth;
            H = window.innerHeight;
            // 设备像素比上限：想更清晰可改为 2.5 或 3（更耗性能）
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(W * dpr);
            canvas.height = Math.floor(H * dpr);
            canvas.style.width = `${W}px`;
            canvas.style.height = `${H}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        fit();
        resizeHandler = () => fit();
        window.addEventListener('resize', resizeHandler);

        // 【二-M】小屏 /「手机模式」：视口宽度 ≤ MOBILE_VIEWPORT_MAX_W 或与媒体查询同时满足时
        // 使用更少的粒子、更小的纸片，减轻发热与掉帧。阈值与数量仅改本段常量即可。
        const MOBILE_VIEWPORT_MAX_W = 640;
        const isMobileViewport =
            W <= MOBILE_VIEWPORT_MAX_W ||
            (typeof window.matchMedia === 'function' &&
                window.matchMedia('(max-width: 767px)').matches);

        // -----------------------------------------------------------------
        // ★ CONFIG：单次播放 —— 调手感优先改这一块（单位与 REF_MS 配套）
        // -----------------------------------------------------------------
        /** 自由落体阶段：竖直方向每「归一化帧」增加的速度（越大落得越快） */
        const gravity = 0.25;
        /** 初速度基准；整体「喷得多猛」主要看它和 velocityVariation */
        const initialVelocity = 5;
        /** 在 initialVelocity 上叠加的随机上限（每条粒子 0～该值） */
        const velocityVariation = 20;
        /** 爆发结束后：水平空气阻力，每归一化帧乘一次（越小横向停得越快） */
        const dragCoefficient = 0.98;
        /** 爆发阶段时长（毫秒）：此期间只衰减速度、不加重力，对应参考 HTML 前 500ms */
        const initialBurstDuration = 500;
        /**
         * 发射交错（毫秒）：每条粒子延迟 0～staggerMaxMs 再开始运动。
         * 设为 0 = 一瞬间全部发射；设为例如 800 = 约 0.8 秒内陆续出现。
         */
        const staggerMaxMs = 0;
        /** 桌面端粒子条数（越大越密，CPU 越高） */
        const particleCountDesktop = 180;
        /** 小屏端粒子条数：建议约为桌面的 45%～55% */
        const particleCountMobile = 120;
        const particleCount = isMobileViewport ? particleCountMobile : particleCountDesktop;
        /** 纸片线性尺寸：桌面「5～15」；手机「约 2.5～7.5」 */
        const particleSizeMin = isMobileViewport ? 2.5 : 5;
        const particleSizeSpan = isMobileViewport ? 5 : 10;
        // -----------------------------------------------------------------

        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const side = Math.random() < 0.5 ? 'left' : 'right';
            const x = side === 'left' ? 0 : W;
            // 【二-C】发射高度：从屏幕靠下区域喷出。0.8～1.0 = 底部 20% 高度内随机
            const y = H * (0.8 + Math.random() * 0.2);

            let angle;
            if (side === 'left') {
                // 左侧：扇形朝上偏右（弧度区间可改宽窄）
                angle = -Math.PI / 2 + (Math.random() * Math.PI) / 4;
            } else {
                // 右侧：扇形朝上偏左
                angle = (Math.PI * 3) / 2 - (Math.random() * Math.PI) / 4;
            }

            const velocity = initialVelocity + Math.random() * velocityVariation;
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity;
            const color = COLORS[(Math.random() * COLORS.length) | 0];
            const shapeRoll = Math.random();
            // 【二-C】三种形状占比：三个阈值决定圆 / 矩形 / 三角的大致比例
            const shape = shapeRoll < 0.33 ? 'circle' : shapeRoll < 0.66 ? 'rect' : 'triangle';
            // 【二-C】纸片大小：见 CONFIG 中 particleSizeMin / particleSizeSpan
            const size = Math.random() * particleSizeSpan + particleSizeMin;
            const staggerMs = staggerMaxMs > 0 ? Math.random() * staggerMaxMs : 0;
            const rotation = Math.random() * 360;
            // 【二-C】每归一化帧旋转量：约 -0.1～0.1；绝对值越大转得越快
            const rotateVel = Math.random() * 0.2 - 0.1;

            particles.push({
                x,
                y,
                vx,
                vy,
                color,
                shape,
                size,
                staggerMs,
                rotation,
                rotateVel,
                alive: true,
            });
        }

        const effectStart = performance.now();
        let lastTimestamp = effectStart;
        // 【二-D】整段特效最长持续时间（毫秒）：过短会提前清屏；过长会多跑空帧
        const maxEffectMs = 6500 + staggerMaxMs;

        /** 【二-F】绘制单粒子：不透明度 = master * 下系数，想更实可把 0.9 调大 */
        function drawParticle(p, alpha) {
            const [r, g, b] = hexToRgb(p.color);
            ctx.save();
            ctx.globalAlpha = alpha * 0.9;
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, '0')).join('');

            const s = p.size;
            if (p.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.shape === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(0, -s * 0.55);
                ctx.lineTo(-s * 0.5, s * 0.45); 
                ctx.lineTo(s * 0.5, s * 0.45);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillRect(-s * 0.5, -s * 0.5, s, s * 1.1);
            }
            ctx.restore();
        }

        function step(timestamp) {
            const now = timestamp;
            // 【二-E】单帧间隔上限（毫秒）：防切后台后 dt 过大导致一次跳飞
            const dt = Math.min(now - lastTimestamp, 48);
            lastTimestamp = now;
            const dtNorm = dt / REF_MS;

            const elapsed = now - effectStart;
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'source-over';

            // 【二-E】整体淡入：分母越大开头越慢显（当前约 0.22s 到满不透明）
            const fadeIn = Math.min(1, elapsed / 220);
            // 【二-E】整体淡出：最后 900ms 线性淡出；改 900 或除数调整尾巴长短
            const fadeOut =
                elapsed > maxEffectMs - 900 ? Math.max(0, 1 - (elapsed - (maxEffectMs - 900)) / 900) : 1;
            const master = fadeIn * fadeOut;

            let anyVisible = false;

            for (const p of particles) {
                if (!p.alive) continue;

                const local = elapsed - p.staggerMs;
                if (local < 0) {
                    anyVisible = true;
                    continue;
                }

                if (local < initialBurstDuration) {
                    // 【二-E】爆发期速度衰减：底数越接近 1 喷得越「持久」
                    p.vx *= Math.pow(0.99, dtNorm);
                    p.vy *= Math.pow(0.99, dtNorm);
                } else {
                    p.vy += gravity * dtNorm;
                    p.vx *= Math.pow(dragCoefficient, dtNorm);
                }

                p.x += p.vx * dtNorm;
                p.y += p.vy * dtNorm;
                p.rotation += p.rotateVel * dtNorm;

                // 【二-E】飞出多少像素算离场（越大越晚删粒子，可能多画几帧）
                const margin = 80;
                if (
                    p.y > H + margin ||
                    p.y < -margin ||
                    p.x < -margin ||
                    p.x > W + margin
                ) {
                    p.alive = false;
                    continue;
                }

                anyVisible = true;
                drawParticle(p, master);
            }

            ctx.globalCompositeOperation = 'source-over';

            if (elapsed < maxEffectMs && anyVisible) {
                rafId = requestAnimationFrame(step);
            } else {
                removeActive();
            }
        }

        rafId = requestAnimationFrame(step);
    }

    window.playVictoryRibbonEffect = playVictoryRibbonEffect;
})();
