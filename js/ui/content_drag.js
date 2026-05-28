/**
 * 拖拽功能模块
 * 提供滚动容器的拖拽：宽屏以下横向 + 纵向（与 scroll-container 滚动一致）
 */

// 初始化拖拽功能
function initDragFunctionality() {
    const scrollContainer = document.querySelector('.scroll-container');
    const guessingElement = document.querySelector('.guessing');

    if (!scrollContainer || !guessingElement) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let velocityY = 0;
    let momentumRAF = null;

    const startDrag = (e) => {
        if (window.innerWidth >= 1200) return;

        if (momentumRAF) {
            cancelAnimationFrame(momentumRAF);
            momentumRAF = null;
        }

        isDragging = true;
        startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
        startY = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
        scrollLeft = scrollContainer.scrollLeft;
        scrollTop = scrollContainer.scrollTop;

        lastX = startX;
        lastY = startY;
        lastTime = performance.now();
        velocity = 0;
        velocityY = 0;

        guessingElement.classList.add('dragging');
    };

    const drag = (e) => {
        if (!isDragging) return;

        e.preventDefault();
        const x = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
        const y = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
        const walk = (x - startX) * 2;
        scrollContainer.scrollLeft = scrollLeft - walk;
        const walkY = (y - startY) * 2;
        scrollContainer.scrollTop = scrollTop - walkY;

        const now = performance.now();
        const dt = Math.max(1, now - lastTime);
        const deltaX = x - lastX;
        lastX = x;
        const deltaY = y - lastY;
        lastY = y;
        lastTime = now;
        const walkDelta = deltaX * 2;
        velocity = -walkDelta / dt;
        const walkDeltaY = deltaY * 2;
        velocityY = -walkDeltaY / dt;
    };

    const endDrag = () => {
        const wasDragging = isDragging;
        isDragging = false;
        guessingElement.classList.remove('dragging');

        if (!wasDragging) return;
        const startMomentum = () => {
            if (window.innerWidth >= 1200) return;
            let v = velocity;
            let vy = velocityY;
            const friction = 0.75;
            const minVel = 0.05;

            if (Math.abs(v) < minVel && Math.abs(vy) < minVel) return;

            let prev = null;
            const step = (ts) => {
                if (isDragging) {
                    momentumRAF = null;
                    return;
                }
                if (prev === null) prev = ts;
                const dt = Math.min(50, ts - prev);
                prev = ts;

                const maxScroll = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
                const maxScrollY = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
                const next = Math.max(0, Math.min(maxScroll, scrollContainer.scrollLeft + v * dt));
                const nextY = Math.max(0, Math.min(maxScrollY, scrollContainer.scrollTop + vy * dt));
                const atEdge = (next === 0 && v < 0) || (next === maxScroll && v > 0);
                const atEdgeY = (nextY === 0 && vy < 0) || (nextY === maxScrollY && vy > 0);

                scrollContainer.scrollLeft = next;
                scrollContainer.scrollTop = nextY;

                v *= friction;
                vy *= friction;
                if (atEdge) v = 0;
                if (atEdgeY) vy = 0;

                if (Math.abs(v) < minVel && Math.abs(vy) < minVel) {
                    momentumRAF = null;
                    return;
                }
                momentumRAF = requestAnimationFrame(step);
            };
            momentumRAF = requestAnimationFrame(step);
        };

        startMomentum();
    };

    guessingElement.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseleave', endDrag);

    guessingElement.addEventListener('touchstart', startDrag, { passive: true });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', endDrag);

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1200) {
            scrollContainer.scrollLeft = 0;
            scrollContainer.scrollTop = 0;
        }
    });
}
