/**
 * 猜对全中时的全屏彩带（迁移自 js/effects/victory_ribbons_effect.js，逻辑原样保留）
 * 对外接口：playVictoryRibbon()，可重复调用，会打断上一次。
 */
const COLORS = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4',
  '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107',
  '#FF9800', '#FF5722',
]

const REF_MS = 1000 / 60

let activeCanvas: HTMLCanvasElement | null = null
let rafId = 0
let resizeHandler: (() => void) | null = null

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  shape: 'circle' | 'rect' | 'triangle'
  size: number
  staggerMs: number
  rotation: number
  rotateVel: number
  alive: boolean
}

function removeActive(): void {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  if (activeCanvas && activeCanvas.parentNode) {
    activeCanvas.remove()
  }
  activeCanvas = null
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 播放一次胜利彩带 */
export function playVictoryRibbon(): void {
  removeActive()

  const canvas = document.createElement('canvas')
  canvas.className = 'victory-ribbon-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText =
    'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:10050;'
  document.body.appendChild(canvas)
  activeCanvas = canvas

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

  let W = 0
  let H = 0
  let dpr = 1

  function fit(): void {
    W = window.innerWidth
    H = window.innerHeight
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  fit()
  resizeHandler = () => fit()
  window.addEventListener('resize', resizeHandler)

  const MOBILE_VIEWPORT_MAX_W = 640
  const isMobileViewport =
    W <= MOBILE_VIEWPORT_MAX_W ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches)

  const gravity = 0.25
  const initialVelocity = 5
  const velocityVariation = 20
  const dragCoefficient = 0.98
  const initialBurstDuration = 500
  const staggerMaxMs = 0
  const particleCountDesktop = 180
  const particleCountMobile = 120
  const particleCount = isMobileViewport ? particleCountMobile : particleCountDesktop
  const particleSizeMin = isMobileViewport ? 2.5 : 5
  const particleSizeSpan = isMobileViewport ? 5 : 10

  const particles: Particle[] = []

  for (let i = 0; i < particleCount; i++) {
    const side = Math.random() < 0.5 ? 'left' : 'right'
    const x = side === 'left' ? 0 : W
    const y = H * (0.8 + Math.random() * 0.2)

    let angle: number
    if (side === 'left') {
      angle = -Math.PI / 2 + (Math.random() * Math.PI) / 4
    } else {
      angle = (Math.PI * 3) / 2 - (Math.random() * Math.PI) / 4
    }

    const velocity = initialVelocity + Math.random() * velocityVariation
    const vx = Math.cos(angle) * velocity
    const vy = Math.sin(angle) * velocity
    const color = COLORS[(Math.random() * COLORS.length) | 0]
    const shapeRoll = Math.random()
    const shape: Particle['shape'] = shapeRoll < 0.33 ? 'circle' : shapeRoll < 0.66 ? 'rect' : 'triangle'
    const size = Math.random() * particleSizeSpan + particleSizeMin
    const staggerMs = staggerMaxMs > 0 ? Math.random() * staggerMaxMs : 0
    const rotation = Math.random() * 360
    const rotateVel = Math.random() * 0.2 - 0.1

    particles.push({ x, y, vx, vy, color, shape, size, staggerMs, rotation, rotateVel, alive: true })
  }

  const effectStart = performance.now()
  let lastTimestamp = effectStart
  const maxEffectMs = 6500 + staggerMaxMs

  function drawParticle(p: Particle, alpha: number): void {
    const [r, g, b] = hexToRgb(p.color)
    ctx.save()
    ctx.globalAlpha = alpha * 0.9
    ctx.translate(p.x, p.y)
    ctx.rotate((p.rotation * Math.PI) / 180)
    ctx.fillStyle = '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, '0')).join('')

    const s = p.size
    if (p.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2)
      ctx.fill()
    } else if (p.shape === 'triangle') {
      ctx.beginPath()
      ctx.moveTo(0, -s * 0.55)
      ctx.lineTo(-s * 0.5, s * 0.45)
      ctx.lineTo(s * 0.5, s * 0.45)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.fillRect(-s * 0.5, -s * 0.5, s, s * 1.1)
    }
    ctx.restore()
  }

  function step(timestamp: number): void {
    const now = timestamp
    const dt = Math.min(now - lastTimestamp, 48)
    lastTimestamp = now
    const dtNorm = dt / REF_MS

    const elapsed = now - effectStart
    ctx.clearRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'

    const fadeIn = Math.min(1, elapsed / 220)
    const fadeOut = elapsed > maxEffectMs - 900 ? Math.max(0, 1 - (elapsed - (maxEffectMs - 900)) / 900) : 1
    const master = fadeIn * fadeOut

    let anyVisible = false

    for (const p of particles) {
      if (!p.alive) continue

      const local = elapsed - p.staggerMs
      if (local < 0) {
        anyVisible = true
        continue
      }

      if (local < initialBurstDuration) {
        p.vx *= Math.pow(0.99, dtNorm)
        p.vy *= Math.pow(0.99, dtNorm)
      } else {
        p.vy += gravity * dtNorm
        p.vx *= Math.pow(dragCoefficient, dtNorm)
      }

      p.x += p.vx * dtNorm
      p.y += p.vy * dtNorm
      p.rotation += p.rotateVel * dtNorm

      const margin = 80
      if (p.y > H + margin || p.y < -margin || p.x < -margin || p.x > W + margin) {
        p.alive = false
        continue
      }

      anyVisible = true
      drawParticle(p, master)
    }

    ctx.globalCompositeOperation = 'source-over'

    if (elapsed < maxEffectMs && anyVisible) {
      rafId = requestAnimationFrame(step)
    } else {
      removeActive()
    }
  }

  rafId = requestAnimationFrame(step)
}
