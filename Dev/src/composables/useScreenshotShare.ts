/**
 * 截图分享组合式函数（迁移自 js/ui/screenshot/daily_win_screenshot_share.js）
 *
 * 功能：每日通关后生成「方格遮蔽」分享图（不暴露答案）。
 * - 构建截图专用布局（克隆主界面 DOM + 遮蔽样式）
 * - 本地 html2canvas 渲染（npm 包）或服务端 Playwright（window.ARKDLE_SCREENSHOT_API）
 * - 弹窗状态由 ref 驱动 Vue 组件渲染
 */
import { ref } from 'vue'
import html2canvas from 'html2canvas'
import { getTodayStr } from '../utils/date'

// ---- 配置：可通过 window.ARKDLE_SCREENSHOT_API / ARKDLE_SCREENSHOT_SECRET 覆盖 ----
function getScreenshotApiUrl(): string {
  try {
    const v = (window as unknown as Record<string, unknown>).ARKDLE_SCREENSHOT_API
    if (typeof v === 'string' && v.trim()) return v.trim()
  } catch {
    /* ignore */
  }
  return ''
}

function getScreenshotSecret(): string {
  try {
    const v = (window as unknown as Record<string, unknown>).ARKDLE_SCREENSHOT_SECRET
    if (typeof v === 'string' && v.trim()) return v.trim()
  } catch {
    /* ignore */
  }
  return ''
}

// ---- 弹窗状态 ----
export const screenshotShareState = ref<{
  visible: boolean
  statusText: string
  statusOk: boolean
  generating: boolean
  step: 'layout' | 'result'
  previewSrc: string
}>({
  visible: false,
  statusText: '',
  statusOk: false,
  generating: false,
  step: 'layout',
  previewSrc: '',
})

let lastCanvas: HTMLCanvasElement | null = null
let lastPreparedLayout: HTMLElement | null = null
let shareInProgress = false

/** 方格遮蔽文字：手机窄屏 1 个 ■，否则 4 个 */
function getShareMaskOperText(): string {
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches) {
      return '\u25A0'
    }
  } catch {
    /* ignore */
  }
  return '\u25A0\u25A0\u25A0\u25A0'
}

/** 处理格子展示：▲/▼ 方向 + 遮蔽方格（迁移 applyShareOperCellPresentation） */
function applyShareOperCellPresentation(root: HTMLElement, maskCells: boolean): void {
  const maskText = maskCells ? getShareMaskOperText() : ''
  root.querySelectorAll('.oper-item').forEach((el) => {
    const isMore = el.classList.contains('oper-more')
    const isLess = el.classList.contains('oper-less')
    const origText = (el.textContent || '').trim()
    el.replaceChildren()

    if (isMore) {
      const up = document.createElement('span')
      up.className = 'arkdle-share-arrow arkdle-share-arrow--up'
      up.textContent = '\u25B2'
      up.setAttribute('aria-hidden', 'true')
      el.appendChild(up)
    }
    if (maskCells) {
      const span = document.createElement('span')
      span.className = 'arkdle-share-mask-fill'
      span.textContent = maskText
      el.appendChild(span)
    } else {
      const t = document.createElement('span')
      t.className = 'arkdle-share-value-text'
      t.textContent = origText
      el.appendChild(t)
    }
    if (isLess) {
      const down = document.createElement('span')
      down.className = 'arkdle-share-arrow arkdle-share-arrow--down'
      down.textContent = '\u25BC'
      down.setAttribute('aria-hidden', 'true')
      el.appendChild(down)
    }
  })
}

/** 截图布局专用覆盖样式（迁移 buildCaptureHost 内注入的 <style>） */
const SHARE_STRIP_GLOW_CSS = [
  '.arkdle-share-capture-host .scroll-container { align-items: stretch !important; }',
  '.arkdle-share-capture-host .guessing-item { justify-items: stretch !important; width: 100% !important; max-width: 100%; box-sizing: border-box; }',
  '.arkdle-share-capture-host .guessing-info { width: 100% !important; max-width: 100%; box-sizing: border-box; grid-template-columns: repeat(13, minmax(0, 1fr)) !important; align-items: stretch; }',
  '.arkdle-share-capture-host .guessing-info.guessing-info--compact { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }',
  '.arkdle-share-capture-host .guessing-info > div { min-width: 0 !important; width: 100% !important; max-width: 100%; box-sizing: border-box; }',
  '.arkdle-share-capture-host .guessing-info.guessing-info--victory::before { display: none !important; content: none !important; }',
  '.arkdle-share-capture-host .guessing-info.guessing-info--victory { border: none !important; border-radius: 0 !important; box-sizing: border-box; }',
  '.arkdle-share-capture-host .guessing-info.guessing-info--victory > * { filter: none !important; }',
  '.arkdle-share-capture-host .oper-item.oper-equal { background: var(--box-true) !important; box-shadow: none !important; }',
  '.arkdle-share-capture-host .oper-item.oper-different, .arkdle-share-capture-host .oper-item.oper-more, .arkdle-share-capture-host .oper-item.oper-less { background: var(--box-false) !important; }',
  '.arkdle-share-capture-host .oper-item.oper-approximate { background: var(--box-fuzzyA) !important; }',
  '.arkdle-share-capture-host .oper-item.oper-fuzzy { background: var(--box-fuzzyB) !important; }',
  '.arkdle-share-capture-host .guessing-info.guessing-info--victory .oper-item.oper-equal { background: #71c9ff !important; color: #1a1a1a !important; box-shadow: none !important; }',
  '.arkdle-share-capture-host .oper-item.oper-col-text { background: var(--ark-black-08) !important; box-shadow: none !important; }',
  '.arkdle-share-capture-host .oper-item.oper-col-fuzzy-text.oper-fuzzy { background: var(--box-fuzzyB) !important; }',
  '.arkdle-share-capture-host .oper-more::before, .arkdle-share-capture-host .oper-less::before { content: none !important; display: none !important; border: none !important; width: 0 !important; height: 0 !important; }',
  '.arkdle-share-capture-host .oper-item { position: relative !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 0 !important; min-width: 0 !important; max-width: 100%; }',
  '.arkdle-share-capture-host .oper-item > * { background: transparent !important; background-color: transparent !important; background-image: none !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; }',
  '.arkdle-share-capture-host.arkdle-share-rabbit-off .oper-item.rabbit-stat, .arkdle-share-capture-host.arkdle-share-rabbit-off .guessing-head.rabbit-stat { display: none !important; }',
  '.arkdle-share-capture-host .oper-item .arkdle-share-mask-fill { display: inline-block; line-height: 1.15; max-width: 100%; overflow: hidden; font-size: clamp(8px, 1.8vw, 12px); }',
  '.arkdle-share-capture-host .oper-item .arkdle-share-value-text { display: inline-block; line-height: 1.15; font-size: inherit; }',
  '.arkdle-share-capture-host .oper-item .arkdle-share-arrow--up, .arkdle-share-capture-host .oper-item .arkdle-share-arrow--down { position: absolute !important; left: 50%; transform: translate(-50%, -50%); display: block; line-height: 1; font-size: 9px; font-weight: 700; color: #1a1a1a; pointer-events: none; margin: 0; width: max-content; }',
  '.arkdle-share-capture-host .oper-item .arkdle-share-arrow--up { top: 20%; }',
  '.arkdle-share-capture-host .oper-item .arkdle-share-arrow--down { top: 80%; }',
  '@media (max-width: 768px) { .arkdle-share-capture-host .oper-item .arkdle-share-arrow--up, .arkdle-share-capture-host .oper-item .arkdle-share-arrow--down { font-size: 6px; transform: translate(-50%, -50%) scale(0.82); } }',
].join('\n')

/** 构建截图专用布局（迁移 buildCaptureHost）：克隆 header/container/scroll/footer + 遮蔽样式 */
function buildCaptureHost(maskCells: boolean): HTMLElement {
  const host = document.createElement('div')
  host.className = 'arkdle-share-capture-host'
  host.setAttribute('aria-hidden', 'true')
  if (document.body.classList.contains('rabbit-mode-off')) {
    host.classList.add('arkdle-share-rabbit-off')
  }

  const header = document.querySelector('header')
  if (header) {
    const hc = header.cloneNode(true) as HTMLElement
    const topTool = hc.querySelector('.top-tool')
    if (topTool) topTool.remove()
    host.appendChild(hc)
  }

  const container = document.querySelector('.container')
  if (container) {
    const subWrap = document.createElement('div')
    subWrap.className = 'arkdle-share-sublabels'
    container.querySelectorAll(':scope > .sub-label').forEach((n) => {
      subWrap.appendChild(n.cloneNode(true))
    })
    host.appendChild(subWrap)
  }

  const scrollEl = document.querySelector('.scroll-container')
  if (scrollEl) {
    const sc = scrollEl.cloneNode(true) as HTMLElement
    sc.style.overflow = 'visible'
    sc.style.minHeight = 'auto'
    host.appendChild(sc)
  }

  const footer = document.querySelector('footer')
  if (footer) {
    const footerBlock = document.createElement('div')
    footerBlock.className = 'arkdle-share-footer-block'
    ;['#copyright-line', '#editinfo', '.creator-credit'].forEach((sel) => {
      const node = footer.querySelector(sel)
      if (node) footerBlock.appendChild(node.cloneNode(true))
    })
    host.appendChild(footerBlock)
  }

  const style = document.createElement('style')
  style.setAttribute('data-arkdle-share-strip-glow', '1')
  style.textContent = SHARE_STRIP_GLOW_CSS
  host.appendChild(style)

  applyShareOperCellPresentation(host, maskCells)
  return host
}

function mountHiddenCaptureHost(host: HTMLElement): void {
  host.classList.add('arkdle-share-capture-host--offscreen')
  host.setAttribute('aria-hidden', 'true')
  document.body.appendChild(host)
}

function removeCaptureHost(host: HTMLElement | null): void {
  if (host && host.parentNode) host.parentNode.removeChild(host)
}

// ---- html2canvas 兼容修正（color-mix 等）----
function looksLikeUnsupportedColorCss(str: string | null | undefined): boolean {
  if (!str || str === 'none' || str === 'auto' || str === 'transparent') return false
  return /color-mix\b|\bcolor\s*\(|oklab\b|oklch\b|\blab\s*\(|\blch\s*\(|\bhwb\s*\(/i.test(str)
}

function fixCloneDocumentForHtml2Canvas(clonedDoc: Document): void {
  const style = clonedDoc.createElement('style')
  style.setAttribute('data-arkdle-html2canvas-fix', '1')
  style.textContent = [
    'html { background-color:#f6f8fb !important; background-image:none !important; }',
    'body { background-color:#f6f8fb !important; background-image:none !important; }',
    'body::before, body::after { content:none !important; display:none !important; background:none !important; background-image:none !important; }',
  ].join(' ')
  clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild)
}

function assignSnapshotIds(root: HTMLElement): void {
  let i = 1
  root.setAttribute('data-arkdle-snap-id', String(i++))
  root.querySelectorAll('*').forEach((el) => el.setAttribute('data-arkdle-snap-id', String(i++)))
}

function snapshotComputedStylesOntoCloneById(originalRoot: HTMLElement, clonedRoot: HTMLElement): void {
  const win = originalRoot.ownerDocument?.defaultView || window
  const cloneMap = new Map<string, Element>()
  ;[clonedRoot, ...clonedRoot.querySelectorAll('[data-arkdle-snap-id]')].forEach((el) => {
    const id = el.getAttribute('data-arkdle-snap-id')
    if (id) cloneMap.set(id, el)
  })
  ;[originalRoot, ...originalRoot.querySelectorAll('[data-arkdle-snap-id]')].forEach((o) => {
    const id = o.getAttribute('data-arkdle-snap-id')
    if (!id) return
    const c = cloneMap.get(id)
    if (!c) return
    const cs = win.getComputedStyle(o)
    // CSSStyleDeclaration 不支持字符串索引，转 map 以便用变量键访问
    const csMap = cs as unknown as Record<string, string>
    const styleMap = (c as HTMLElement).style as unknown as Record<string, string>
    styleMap.backgroundColor = looksLikeUnsupportedColorCss(cs.backgroundColor) ? '#00000000' : cs.backgroundColor
    styleMap.color = looksLikeUnsupportedColorCss(cs.color) ? '#333333' : cs.color
    ;['Top', 'Right', 'Bottom', 'Left'].forEach((side) => {
      const colorKey = `border${side}Color`
      const styleKey = `border${side}Style`
      const widthKey = `border${side}Width`
      const colorV = looksLikeUnsupportedColorCss(csMap[colorKey]) ? '#00000059' : csMap[colorKey]
      const styleV = csMap[styleKey]
      const widthV = csMap[widthKey]
      if (widthV && widthV !== '0px' && styleV && styleV !== 'none') {
        if (colorV) styleMap[colorKey] = colorV
        styleMap[styleKey] = styleV
        styleMap[widthKey] = widthV
      }
    })
    const br = cs.borderRadius
    if (br && br !== '0px' && !looksLikeUnsupportedColorCss(br)) {
      styleMap.borderRadius = br
    }
    const bgi = cs.backgroundImage
    if (bgi && bgi !== 'none' && looksLikeUnsupportedColorCss(bgi)) {
      styleMap.backgroundImage = 'none'
    }
    for (const shadowKey of ['boxShadow', 'textShadow']) {
      const sv = csMap[shadowKey]
      if (sv && sv !== 'none' && looksLikeUnsupportedColorCss(sv)) {
        styleMap[shadowKey] = 'none'
      }
    }
  })
}

/** 同步导出 host 的布局尺寸（迁移 syncExportHostLayoutFromSource） */
function syncExportHostLayoutFromSource(sourceHost: HTMLElement, exportHost: HTMLElement): void {
  try {
    const win = sourceHost.ownerDocument?.defaultView || window
    const rect = sourceHost.getBoundingClientRect()
    const sourceStyle = win.getComputedStyle(sourceHost)
    if (rect.width > 0) {
      const widthPx = `${Math.round(rect.width)}px`
      exportHost.style.width = widthPx
      exportHost.style.maxWidth = widthPx
      exportHost.style.minWidth = widthPx
    }
    exportHost.style.padding = sourceStyle.padding
    exportHost.style.marginLeft = sourceStyle.marginLeft
    exportHost.style.marginRight = sourceStyle.marginRight
    exportHost.style.background = sourceStyle.background
    exportHost.style.boxSizing = sourceStyle.boxSizing
  } catch {
    /* ignore */
  }
}

// ---- 服务端截图 ----
function pageDirectoryBaseUrl(): string {
  try {
    const page = new URL(window.location.href)
    let p = page.pathname
    if (p && !p.endsWith('/')) {
      const lastSeg = p.split('/').pop() || ''
      if (lastSeg.includes('.')) p = p.slice(0, p.lastIndexOf('/') + 1)
      else p = `${p}/`
    }
    page.pathname = p || '/'
    page.hash = ''
    page.search = ''
    return page.href
  } catch {
    return `${window.location.origin}/`
  }
}

function collectStylesheetAbsoluteHrefs(): string[] {
  const out: string[] = []
  try {
    document.querySelectorAll('link[rel="stylesheet"][href]').forEach((l) => {
      const href = l.getAttribute('href')
      if (!href) return
      out.push(new URL(href, window.location.href).href)
    })
  } catch {
    /* ignore */
  }
  return out
}

async function requestServerScreenshotPng(host: HTMLElement): Promise<Blob> {
  const api = getScreenshotApiUrl()
  const baseUrl = pageDirectoryBaseUrl()
  const cssHrefs = collectStylesheetAbsoluteHrefs()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const secret = getScreenshotSecret()
  if (secret) headers['X-Arkdle-Screenshot-Secret'] = secret

  const res = await fetch(api, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      htmlFragment: host.outerHTML,
      baseUrl,
      cssHrefs,
      selector: '.arkdle-share-capture-host',
      deviceScaleFactor: 2,
    }),
    mode: 'cors',
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || `HTTP ${res.status}`)
  }
  return res.blob()
}

async function blobPngToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('图片加载失败'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 Canvas 上下文')
    ctx.drawImage(img, 0, 0)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function runCaptureToCanvas(sourceHost: HTMLElement): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {})

  const exportHost = sourceHost.cloneNode(true) as HTMLElement
  exportHost.setAttribute('aria-hidden', 'true')
  syncExportHostLayoutFromSource(sourceHost, exportHost)

  const api = getScreenshotApiUrl()
  if (api) {
    try {
      exportHost.style.position = 'relative'
      exportHost.style.left = '0'
      exportHost.style.top = '0'
      exportHost.style.zIndex = '0'
      mountHiddenCaptureHost(exportHost)
      const blob = await requestServerScreenshotPng(exportHost)
      return await blobPngToCanvas(blob)
    } finally {
      removeCaptureHost(exportHost)
    }
  }

  try {
    mountHiddenCaptureHost(exportHost)
    assignSnapshotIds(exportHost)
    const canvas = await html2canvas(exportHost, {
      scale: 2,
      backgroundColor: '#f6f8fb',
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone(clonedDoc, clonedEl) {
        try {
          fixCloneDocumentForHtml2Canvas(clonedDoc)
          snapshotComputedStylesOntoCloneById(exportHost, clonedEl as HTMLElement)
        } catch (err) {
          console.warn('[截图分享] onclone 样式修正失败', err)
        }
      },
    })
    return canvas
  } finally {
    removeCaptureHost(exportHost)
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('无法导出 PNG'))
      }, 'image/png')
    } catch (e) {
      reject(e)
    }
  })
}

// ---- 对外 API ----
export function useScreenshotShare() {
  const state = screenshotShareState

  function open(): void {
    if (shareInProgress) return
    state.value.visible = true
    state.value.statusText = '已创建可检查的截图布局，请先确认样式，再点击“生成截图”。'
    state.value.statusOk = false
    state.value.generating = false
    state.value.step = 'layout'
    state.value.previewSrc = ''
    lastCanvas = null

    // 布局预览
    clearPreparedLayout()
    const mount = document.getElementById('arkdle-share-layout-preview')
    if (mount) {
      const shell = document.createElement('div')
      shell.className = 'arkdle-share-modal__layout-shell'
      const host = buildCaptureHost(true)
      host.removeAttribute('aria-hidden')
      shell.appendChild(host)
      mount.appendChild(shell)
      lastPreparedLayout = host
    }
    document.body.classList.add('arkdle-share-modal-open')
  }

  function clearPreparedLayout(): void {
    if (lastPreparedLayout) {
      removeCaptureHost(lastPreparedLayout)
      lastPreparedLayout = null
    }
    const mount = document.getElementById('arkdle-share-layout-preview')
    if (mount) mount.replaceChildren()
  }

  async function generate(): Promise<void> {
    if (shareInProgress) return
    if (!lastPreparedLayout) {
      open()
      return
    }
    shareInProgress = true
    state.value.generating = true
    state.value.statusText = '正在根据当前检查布局生成截图…'
    state.value.statusOk = false
    try {
      const canvas = await runCaptureToCanvas(lastPreparedLayout)
      lastCanvas = canvas
      state.value.previewSrc = canvas.toDataURL('image/png')
      state.value.step = 'result'
      state.value.statusText = ''
    } catch (e) {
      console.error('[截图分享]', e)
      state.value.statusText = getScreenshotApiUrl()
        ? '生成分享图失败，请确认截图服务已启动且 window.ARKDLE_SCREENSHOT_API 配置正确。'
        : '生成分享图失败，请重试。'
    } finally {
      shareInProgress = false
      state.value.generating = false
    }
  }

  function download(): void {
    if (!lastCanvas) return
    const name = `arkdle-daily-${getTodayStr()}.png`
    const a = document.createElement('a')
    a.download = name
    a.href = lastCanvas.toDataURL('image/png')
    a.click()
  }

  async function copyToClipboard(): Promise<void> {
    if (!lastCanvas) return
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('CLIPBOARD_UNSUPPORTED')
      }
      const blob = await canvasToPngBlob(lastCanvas)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      state.value.statusText = '已复制到剪贴板'
      state.value.statusOk = true
    } catch (e) {
      const tip =
        e instanceof Error && e.message === 'CLIPBOARD_UNSUPPORTED'
          ? '当前环境不支持将图片写入剪贴板，请使用「下载截图」保存到本地。'
          : '复制到剪贴板失败（需 HTTPS 或 localhost，并允许剪贴板权限）。可改用「下载截图」。'
      alert(tip)
    }
  }

  function close(): void {
    state.value.visible = false
    document.body.classList.remove('arkdle-share-modal-open')
    lastCanvas = null
    clearPreparedLayout()
  }

  return { state, open, generate, download, copyToClipboard, close }
}
