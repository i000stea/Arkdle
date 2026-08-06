/**
 * 烟花式彩带（迁移自 js/effects/fireworks_effect.js，逻辑原样保留）
 * 自屏幕下方以较大仰角抛射彩带，至顶点附近后受重力缓缓下落。
 */
interface Ribbon {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  width: number
  angle: number
  rotationSpeed: number
  color: string
  alpha: number
  gravity: number
  friction: number
  life: number
  startLife: number
}

class MovingRibbonEffect {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private ribbons: Ribbon[] = []
  private _cssW = 0
  private _cssH = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.position = 'fixed'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.zIndex = '9999'
    document.body.appendChild(this.canvas)
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context not available')
    this.ctx = ctx
    this.updateCanvasSize()
    window.addEventListener('resize', () => this.updateCanvasSize())
  }

  /** 清空当前彩带（showFireworks 开始时重置） */
  clear(): void {
    this.ribbons = []
  }

  updateCanvasSize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    this.canvas.width = Math.floor(w * dpr)
    this.canvas.height = Math.floor(h * dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this._cssW = w
    this._cssH = h
  }

  /** 自底部区域抛射一条彩带（canvas 坐标系 y 向下，vy 为负表示上升） */
  createRibbonObject(x: number, y: number, direction: 'left' | 'right'): void {
    const maxTilt = Math.PI / 5.2
    let base = -Math.PI / 2
    if (direction === 'left') {
      base += (Math.random() * 0.5 - 0.65) * maxTilt
    } else {
      base += (Math.random() * 0.5 + 0.15) * maxTilt
    }
    const jitter = (Math.random() - 0.5) * (maxTilt * 0.35)
    const angle = base + jitter

    const speed = 11 + Math.random() * 9
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed

    const length = Math.random() * 56 + 36
    const width = Math.random() * 6 + 3.5
    const color = this.getRandomColor()

    const life0 = Math.floor(320 + Math.random() * 220)
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
    })
  }

  getRandomColor(): string {
    const hue = Math.random() * 360
    const saturation = Math.random() * 25 + 72
    const lightness = Math.random() * 18 + 52
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }

  generateRibbons(count: number, direction: 'left' | 'right'): void {
    const W = this._cssW || window.innerWidth
    const H = this._cssH || window.innerHeight

    const yMin = H * 0.82
    const yMax = H * 0.97

    for (let i = 0; i < count; i++) {
      let x: number
      if (direction === 'left') {
        x = Math.random() * (W * 0.48) + W * 0.02
      } else {
        x = W * 0.52 + Math.random() * (W * 0.46)
      }
      const y = yMin + Math.random() * (yMax - yMin)
      this.createRibbonObject(x, y, direction)
    }
  }

  animate(): void {
    const W = this._cssW || window.innerWidth
    const H = this._cssH || window.innerHeight
    this.ctx.clearRect(0, 0, W, H)
    let shouldContinue = false

    for (let i = 0; i < this.ribbons.length; i++) {
      const ribbon = this.ribbons[i]

      if (ribbon.life <= 0) continue

      shouldContinue = true

      ribbon.vy += ribbon.gravity
      ribbon.vx *= ribbon.friction
      ribbon.vy *= ribbon.friction
      ribbon.x += ribbon.vx
      ribbon.y += ribbon.vy

      ribbon.angle = Math.atan2(ribbon.vy, ribbon.vx)
      ribbon.angle += ribbon.rotationSpeed * 0.35

      ribbon.life--
      const t = ribbon.startLife > 0 ? ribbon.life / ribbon.startLife : 0
      ribbon.alpha = Math.max(0, Math.min(1, t * 1.05))

      this.ctx.save()
      this.ctx.globalAlpha = ribbon.alpha
      this.ctx.fillStyle = ribbon.color

      this.ctx.translate(ribbon.x, ribbon.y)
      this.ctx.rotate(ribbon.angle)

      this.ctx.fillRect(-ribbon.length / 2, -ribbon.width / 2, ribbon.length, ribbon.width)

      this.ctx.strokeStyle = '#ffffff73'
      this.ctx.lineWidth = 1
      this.ctx.strokeRect(-ribbon.length / 2, -ribbon.width / 2, ribbon.length, ribbon.width)

      this.ctx.restore()
    }

    if (shouldContinue) {
      requestAnimationFrame(() => this.animate())
    }
  }
}

const movingRibbonEffect = new MovingRibbonEffect()

/** 播放烟花彩带效果 */
export function showFireworks(): void {
  movingRibbonEffect.clear()
  movingRibbonEffect.updateCanvasSize()

  movingRibbonEffect.generateRibbons(22, 'left')
  movingRibbonEffect.generateRibbons(22, 'right')

  movingRibbonEffect.animate()

  setTimeout(() => {
    movingRibbonEffect.generateRibbons(16, 'left')
    movingRibbonEffect.generateRibbons(16, 'right')
  }, 420)

  setTimeout(() => {
    movingRibbonEffect.generateRibbons(12, 'left')
    movingRibbonEffect.generateRibbons(12, 'right')
  }, 880)
}
