/**
 * 烟花式彩带：自屏幕下方以较大仰角抛射，至顶点附近后受重力缓缓下落。
 */
class MovingRibbonEffect {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '9999';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.ribbons = [];
        this.updateCanvasSize();
        window.addEventListener('resize', () => this.updateCanvasSize());
    }

    updateCanvasSize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._cssW = w;
        this._cssH = h;
    }

    /**
     * 自底部区域抛射一条彩带（canvas 坐标系 y 向下，vy 为负表示上升）
     */
    createRibbonObject(x, y, direction) {
        // 以竖直向上为基准，左右略偏，形成「高仰角」扇形
        const maxTilt = Math.PI / 5.2; // 约 ±34.6°，整体仍偏陡
        let base = -Math.PI / 2;
        if (direction === 'left') {
            base += (Math.random() * 0.5 - 0.65) * maxTilt;
        } else {
            base += (Math.random() * 0.5 + 0.15) * maxTilt;
        }
        const jitter = (Math.random() - 0.5) * (maxTilt * 0.35);
        const angle = base + jitter;

        const speed = 11 + Math.random() * 9;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        const length = Math.random() * 56 + 36;
        const width = Math.random() * 6 + 3.5;
        const color = this.getRandomColor();

        const life0 = Math.floor(320 + Math.random() * 220);
        this.ribbons.push({
            x,
            y,
            vx,
            vy,
            length,
            width,
            angle,
            rotationSpeed: (Math.random() - 0.5) * 0.04,
            color,
            alpha: 1,
            gravity: 0.11 + Math.random() * 0.05,
            friction: 0.997,
            life: life0,
            startLife: life0,
        });
    }

    getRandomColor() {
        const hue = Math.random() * 360;
        const saturation = Math.random() * 25 + 72;
        const lightness = Math.random() * 18 + 52;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    /**
     * @param count 数量
     * @param direction 'left' 在画面左半底缘附近发射，'right' 在右半底缘附近发射
     */
    generateRibbons(count, direction) {
        const W = this._cssW || window.innerWidth;
        const H = this._cssH || window.innerHeight;

        const yMin = H * 0.82;
        const yMax = H * 0.97;

        for (let i = 0; i < count; i++) {
            let x;
            if (direction === 'left') {
                x = Math.random() * (W * 0.48) + W * 0.02;
            } else {
                x = W * 0.52 + Math.random() * (W * 0.46);
            }
            const y = yMin + Math.random() * (yMax - yMin);
            this.createRibbonObject(x, y, direction);
        }
    }

    animate() {
        const W = this._cssW || window.innerWidth;
        const H = this._cssH || window.innerHeight;
        this.ctx.clearRect(0, 0, W, H);
        let shouldContinue = false;

        for (let i = 0; i < this.ribbons.length; i++) {
            const ribbon = this.ribbons[i];

            if (ribbon.life <= 0) continue;

            shouldContinue = true;

            ribbon.vy += ribbon.gravity;
            ribbon.vx *= ribbon.friction;
            ribbon.vy *= ribbon.friction;
            ribbon.x += ribbon.vx;
            ribbon.y += ribbon.vy;

            ribbon.angle = Math.atan2(ribbon.vy, ribbon.vx);
            ribbon.angle += ribbon.rotationSpeed * 0.35;

            ribbon.life--;
            const t = ribbon.startLife > 0 ? ribbon.life / ribbon.startLife : 0;
            ribbon.alpha = Math.max(0, Math.min(1, t * 1.05));

            this.ctx.save();
            this.ctx.globalAlpha = ribbon.alpha;
            this.ctx.fillStyle = ribbon.color;

            this.ctx.translate(ribbon.x, ribbon.y);
            this.ctx.rotate(ribbon.angle);

            this.ctx.fillRect(-ribbon.length / 2, -ribbon.width / 2, ribbon.length, ribbon.width);

            this.ctx.strokeStyle = '#ffffff73';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(-ribbon.length / 2, -ribbon.width / 2, ribbon.length, ribbon.width);

            this.ctx.restore();
        }

        if (shouldContinue) {
            requestAnimationFrame(() => this.animate());
        }
    }
}

const movingRibbonEffect = new MovingRibbonEffect();

function showFireworks() {
    movingRibbonEffect.ribbons = [];
    movingRibbonEffect.updateCanvasSize();

    movingRibbonEffect.generateRibbons(22, 'left');
    movingRibbonEffect.generateRibbons(22, 'right');

    movingRibbonEffect.animate();

    setTimeout(() => {
        movingRibbonEffect.generateRibbons(16, 'left');
        movingRibbonEffect.generateRibbons(16, 'right');
    }, 420);

    setTimeout(() => {
        movingRibbonEffect.generateRibbons(12, 'left');
        movingRibbonEffect.generateRibbons(12, 'right');
    }, 880);
}
