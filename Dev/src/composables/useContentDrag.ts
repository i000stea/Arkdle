/**
 * 拖拽滚动（迁移自 js/ui/content_drag.js，逻辑原样保留）
 * 宽屏以下支持横向 + 纵向拖拽滚动，带惯性动量。
 * 在 App onMounted 后调用一次。
 */
export function useContentDrag(): void {
  const scrollContainer = document.querySelector<HTMLElement>('.scroll-container')
  const guessingElement = document.querySelector<HTMLElement>('.guessing')
  if (!scrollContainer || !guessingElement) return

  let isDragging = false
  let startX = 0
  let startY = 0
  let scrollLeft = 0
  let scrollTop = 0
  let lastX = 0
  let lastY = 0
  let lastTime = 0
  let velocity = 0
  let velocityY = 0
  let momentumRAF: number | null = null

  const pointerPos = (e: MouseEvent | TouchEvent): [number, number] => {
    if (e instanceof MouseEvent || e.type.startsWith('mouse')) {
      const me = e as MouseEvent
      return [me.pageX, me.pageY]
    }
    const te = e as TouchEvent
    return [te.touches[0].pageX, te.touches[0].pageY]
  }

  const startDrag = (e: MouseEvent | TouchEvent): void => {
    if (window.innerWidth >= 1200) return
    if (momentumRAF !== null) {
      cancelAnimationFrame(momentumRAF)
      momentumRAF = null
    }

    isDragging = true
    const [x, y] = pointerPos(e)
    startX = x
    startY = y
    scrollLeft = scrollContainer.scrollLeft
    scrollTop = scrollContainer.scrollTop

    lastX = startX
    lastY = startY
    lastTime = performance.now()
    velocity = 0
    velocityY = 0

    guessingElement.classList.add('dragging')
  }

  const drag = (e: MouseEvent | TouchEvent): void => {
    if (!isDragging) return
    e.preventDefault()
    const [x, y] = pointerPos(e)
    const walk = (x - startX) * 2
    scrollContainer.scrollLeft = scrollLeft - walk
    const walkY = (y - startY) * 2
    scrollContainer.scrollTop = scrollTop - walkY

    const now = performance.now()
    const dt = Math.max(1, now - lastTime)
    const deltaX = x - lastX
    lastX = x
    const deltaY = y - lastY
    lastY = y
    lastTime = now
    velocity = -(deltaX * 2) / dt
    velocityY = -(deltaY * 2) / dt
  }

  const endDrag = (): void => {
    const wasDragging = isDragging
    isDragging = false
    guessingElement.classList.remove('dragging')
    if (!wasDragging) return

    let v = velocity
    let vy = velocityY
    const friction = 0.75
    const minVel = 0.05
    if (Math.abs(v) < minVel && Math.abs(vy) < minVel) return

    let prev: number | null = null
    const step = (ts: number): void => {
      if (isDragging) {
        momentumRAF = null
        return
      }
      if (prev === null) prev = ts
      const dt = Math.min(50, ts - prev)
      prev = ts

      const maxScroll = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth)
      const maxScrollY = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
      const next = Math.max(0, Math.min(maxScroll, scrollContainer.scrollLeft + v * dt))
      const nextY = Math.max(0, Math.min(maxScrollY, scrollContainer.scrollTop + vy * dt))
      const atEdge = (next === 0 && v < 0) || (next === maxScroll && v > 0)
      const atEdgeY = (nextY === 0 && vy < 0) || (nextY === maxScrollY && vy > 0)

      scrollContainer.scrollLeft = next
      scrollContainer.scrollTop = nextY

      v *= friction
      vy *= friction
      if (atEdge) v = 0
      if (atEdgeY) vy = 0

      if (Math.abs(v) < minVel && Math.abs(vy) < minVel) {
        momentumRAF = null
        return
      }
      momentumRAF = requestAnimationFrame(step)
    }
    momentumRAF = requestAnimationFrame(step)
  }

  guessingElement.addEventListener('mousedown', startDrag)
  document.addEventListener('mousemove', drag)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('mouseleave', endDrag)

  guessingElement.addEventListener('touchstart', startDrag, { passive: true })
  document.addEventListener('touchmove', drag, { passive: false })
  document.addEventListener('touchend', endDrag)

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1200) {
      scrollContainer.scrollLeft = 0
      scrollContainer.scrollTop = 0
    }
  })
}
