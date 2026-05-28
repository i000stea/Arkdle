/**
 * 每日题目通关后的截图分享：先在弹窗内生成一份可检查的截图布局，再手动生成方格遮蔽图。
 * 依赖：window.getTodayStr、window.arkdleGuessCacheMode。
 * 截图：若设置 `window.ARKDLE_SCREENSHOT_API`（如 http://127.0.0.1:37521），则使用服务端 Playwright 渲染；
 * 否则使用本地 `js/tools/html2canvas.min.js`。可选 `window.ARKDLE_SCREENSHOT_SECRET` 与进程环境变量对应。
 */
(function dailyWinScreenshotShareIIFE() {
    const HTML2CANVAS_SRC = 'js/tools/html2canvas.min.js';

    function getScreenshotApiUrl() {
        try {
            const v = window.ARKDLE_SCREENSHOT_API;
            if (typeof v === 'string' && v.trim()) return v.trim();
        } catch (e) { /* ignore */ }
        return '';
    }

    function getSharePreviewHintText() {
        if (getScreenshotApiUrl()) {
            return '预览如下（方格遮蔽）；分享区域 HTML 会提交至站内截图服务以生成图片，服务不长期保存内容。';
        }
        return '预览如下（方格遮蔽）；图片仅在本地生成，不会上传。';
    }

    function isScreenshotEditPreviewMode() {
        try {
            const p = new URLSearchParams(window.location.search);
            return p.get('edit') === 'true';
        } catch (e) {
            return false;
        }
    }

    /** 当前页面所在目录的绝对 URL（末尾带 /），供 <base> 与样式表解析 */
    function pageDirectoryBaseUrl() {
        try {
            const page = new URL(window.location.href);
            let p = page.pathname;
            if (p && !p.endsWith('/')) {
                const lastSeg = p.split('/').pop() || '';
                if (lastSeg.includes('.')) {
                    p = p.slice(0, p.lastIndexOf('/') + 1);
                } else {
                    p = `${p}/`;
                }
            }
            page.pathname = p || '/';
            page.hash = '';
            page.search = '';
            return page.href;
        } catch (e) {
            return `${window.location.origin}/`;
        }
    }

    function collectStylesheetAbsoluteHrefs() {
        const out = [];
        try {
            document.querySelectorAll('link[rel="stylesheet"][href]').forEach((l) => {
                const href = l.getAttribute('href');
                if (!href) return;
                out.push(new URL(href, window.location.href).href);
            });
        } catch (e) { /* ignore */ }
        return out;
    }

    /** 服务端截图前：脱离离屏 fixed，便于无头浏览器排版与截取 */
    function prepareHostForServerExport(host) {
        if (!host) return;
        host.style.position = 'relative';
        host.style.left = '0';
        host.style.top = '0';
        host.style.zIndex = '0';
    }

    async function requestServerScreenshotPng(host) {
        const api = getScreenshotApiUrl();
        const baseUrl = pageDirectoryBaseUrl();
        const cssHrefs = collectStylesheetAbsoluteHrefs();
        const headers = { 'Content-Type': 'application/json' };
        try {
            const sec = window.ARKDLE_SCREENSHOT_SECRET;
            if (typeof sec === 'string' && sec.trim()) {
                headers['X-Arkdle-Screenshot-Secret'] = sec.trim();
            }
        } catch (e) { /* ignore */ }

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
        });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            throw new Error(t || `HTTP ${res.status}`);
        }
        return await res.blob();
    }

    function loadImageElement(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    if (img.decode) await img.decode();
                } catch (e) { /* ignore */ }
                resolve(img);
            };
            img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
            img.src = src;
        });
    }

    async function blobPngToCanvas(blob) {
        const url = URL.createObjectURL(blob);
        try {
            const img = await loadImageElement(url);
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('无法创建 Canvas 上下文');
            ctx.drawImage(img, 0, 0);
            return canvas;
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    let shareInProgress = false;
    let modalEl = null;
    let lastCanvas = null;
    let lastPreparedLayout = null;

    function loadHtml2CanvasOnce() {
        if (typeof window.html2canvas === 'function') {
            return Promise.resolve(window.html2canvas);
        }
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = HTML2CANVAS_SRC;
            s.async = true;
            s.onload = () => {
                if (typeof window.html2canvas === 'function') resolve(window.html2canvas);
                else reject(new Error('html2canvas 未正确注册'));
            };
            s.onerror = () => reject(new Error('无法加载本地 html2canvas 脚本'));
            document.head.appendChild(s);
        });
    }

    /**
     * 截图专用：用 ▲/▼ 字符替代三角 ::before（绝对定位，与主界面一致不占流内位置，避免方块偏移）；
     * maskCells 为 true 时数据格为遮盖方格：手机窄屏 1 个 ■，否则 4 个；表头不处理。
     */
    function getShareMaskOperText() {
        try {
            if (typeof window.matchMedia === 'function'
                && window.matchMedia('(max-width: 768px)').matches) {
                return '\u25A0';
            }
        } catch (e) { /* ignore */ }
        return '\u25A0\u25A0\u25A0\u25A0';
    }

    function applyShareOperCellPresentation(root, maskCells) {
        const maskText = maskCells ? getShareMaskOperText() : '';
        root.querySelectorAll('.oper-item').forEach((el) => {
            const isMore = el.classList.contains('oper-more');
            const isLess = el.classList.contains('oper-less');
            const origText = (el.textContent || '').trim();
            el.replaceChildren();

            if (isMore) {
                const up = document.createElement('span');
                up.className = 'arkdle-share-arrow arkdle-share-arrow--up';
                up.textContent = '\u25B2';
                up.setAttribute('aria-hidden', 'true');
                el.appendChild(up);
            }
            if (maskCells) {
                const span = document.createElement('span');
                span.className = 'arkdle-share-mask-fill';
                span.textContent = maskText;
                el.appendChild(span);
            } else {
                const t = document.createElement('span');
                t.className = 'arkdle-share-value-text';
                t.textContent = origText;
                el.appendChild(t);
            }
            if (isLess) {
                const down = document.createElement('span');
                down.className = 'arkdle-share-arrow arkdle-share-arrow--down';
                down.textContent = '\u25BC';
                down.setAttribute('aria-hidden', 'true');
                el.appendChild(down);
            }
        });
    }

    function buildCaptureHost(maskCells) {
        const host = document.createElement('div');
        host.className = 'arkdle-share-capture-host';
        host.setAttribute('aria-hidden', 'true');
        if (document.body.classList.contains('rabbit-mode-off')) {
            host.classList.add('arkdle-share-rabbit-off');
        }

        const header = document.querySelector('header');
        if (header) {
            const hc = header.cloneNode(true);
            const topTool = hc.querySelector('.top-tool');
            if (topTool) topTool.remove();
            host.appendChild(hc);
        }

        const container = document.querySelector('.container');
        if (container) {
            const subWrap = document.createElement('div');
            subWrap.className = 'arkdle-share-sublabels';
            container.querySelectorAll(':scope > .sub-label').forEach((n) => {
                subWrap.appendChild(n.cloneNode(true));
            });
            host.appendChild(subWrap);
        }

        const scrollEl = document.querySelector('.scroll-container');
        if (scrollEl) {
            const sc = scrollEl.cloneNode(true);
            sc.style.overflow = 'visible';
            sc.style.minHeight = 'auto';
            host.appendChild(sc);
        }

        const footer = document.querySelector('footer');
        if (footer) {
            const footerBlock = document.createElement('div');
            footerBlock.className = 'arkdle-share-footer-block';
            ['#copyright-line', '#editinfo', '.creator-credit'].forEach((sel) => {
                const node = footer.querySelector(sel);
                if (node) footerBlock.appendChild(node.cloneNode(true));
            });
            host.appendChild(footerBlock);
        }

        const shareStripGlowStyle = document.createElement('style');
        shareStripGlowStyle.setAttribute('data-arkdle-share-strip-glow', '1');
        shareStripGlowStyle.textContent = [
            '.arkdle-share-capture-host .scroll-container {',
            '  align-items: stretch !important;',
            '}',
            '.arkdle-share-capture-host .guessing-item {',
            '  justify-items: stretch !important;',
            '  width: 100% !important;',
            '  max-width: 100%;',
            '  box-sizing: border-box;',
            '}',
            '.arkdle-share-capture-host .guessing-info {',
            '  width: 100% !important;',
            '  max-width: 100%;',
            '  box-sizing: border-box;',
            '  grid-template-columns: repeat(13, minmax(0, 1fr)) !important;',
            '  align-items: stretch;',
            '}',
            '.arkdle-share-capture-host .guessing-info.guessing-info--compact {',
            '  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;',
            '}',
            '.arkdle-share-capture-host .guessing-info > div {',
            '  min-width: 0 !important;',
            '  width: 100% !important;',
            '  max-width: 100%;',
            '  box-sizing: border-box;',
            '}',
            '.arkdle-share-capture-host .guessing-info.guessing-info--victory::before {',
            '  display: none !important;',
            '  content: none !important;',
            '}',
            '.arkdle-share-capture-host .guessing-info.guessing-info--victory {',
            '  border: none !important;',
            '  border-radius: 0 !important;',
            '  box-sizing: border-box;',
            '}',
            '.arkdle-share-capture-host .guessing-info.guessing-info--victory > * {',
            '  filter: none !important;',
            '}',
            '.arkdle-share-capture-host .oper-item.oper-equal {',
            '  background: var(--box-true) !important;',
            '  box-shadow: none !important;',
            '}',
            '.arkdle-share-capture-host .oper-item.oper-different,',
            '.arkdle-share-capture-host .oper-item.oper-more,',
            '.arkdle-share-capture-host .oper-item.oper-less {',
            '  background: var(--box-false) !important;',
            '}',
            '.arkdle-share-capture-host .oper-item.oper-approximate {',
            '  background: var(--box-fuzzyA) !important;',
            '}',
            '.arkdle-share-capture-host .oper-item.oper-fuzzy {',
            '  background: var(--box-fuzzyB) !important;',
            '}',
            '.arkdle-share-capture-host .guessing-info.guessing-info--victory .oper-item.oper-equal {',
            '  background: #71c9ff !important;',
            '  color: #1a1a1a !important;',
            '  box-shadow: none !important;',
            '}',
            '.arkdle-share-capture-host .oper-item.oper-col-text {',
            '  background: var(--ark-black-08) !important;',
            '  box-shadow: none !important;',
            '}',
            '.arkdle-share-capture-host .oper-item.oper-col-fuzzy-text.oper-fuzzy {',
            '  background: var(--box-fuzzyB) !important;',
            '}',
            '.arkdle-share-capture-host .oper-more::before,',
            '.arkdle-share-capture-host .oper-less::before {',
            '  content: none !important;',
            '  display: none !important;',
            '  border: none !important;',
            '  width: 0 !important;',
            '  height: 0 !important;',
            '}',
            '.arkdle-share-capture-host .oper-item {',
            '  position: relative !important;',
            '  display: flex !important;',
            '  flex-direction: column !important;',
            '  align-items: center !important;',
            '  justify-content: center !important;',
            '  gap: 0 !important;',
            '  min-width: 0 !important;',
            '  max-width: 100%;',
            '}',
            '.arkdle-share-capture-host .oper-item > * {',
            '  background: transparent !important;',
            '  background-color: transparent !important;',
            '  background-image: none !important;',
            '  box-shadow: none !important;',
            '  border: none !important;',
            '  border-radius: 0 !important;',
            '}',
            '/* 兔头关闭：须压过上一段 .oper-item 的 display:flex !important，与主界面 syncRabbitModeGrid 一致 */',
            '.arkdle-share-capture-host.arkdle-share-rabbit-off .oper-item.rabbit-stat,',
            '.arkdle-share-capture-host.arkdle-share-rabbit-off .guessing-head.rabbit-stat {',
            '  display: none !important;',
            '}',
            '.arkdle-share-capture-host .oper-item .arkdle-share-mask-fill {',
            '  display: inline-block;',
            '  line-height: 1.15;',
            '  max-width: 100%;',
            '  overflow: hidden;',
            '  font-size: clamp(8px, 1.8vw, 12px);',
            '}',
            '.arkdle-share-capture-host .oper-item .arkdle-share-value-text {',
            '  display: inline-block;',
            '  line-height: 1.15;',
            '  font-size: inherit;',
            '}',
            '.arkdle-share-capture-host .oper-item .arkdle-share-arrow--up {',
            '  position: absolute !important;',
            '  top: 20%;',
            '  left: 50%;',
            '  transform: translate(-50%, -50%);',
            '  display: block;',
            '  line-height: 1;',
            '  font-size: 9px;',
            '  font-weight: 700;',
            '  color: #1a1a1a;',
            '  pointer-events: none;',
            '  margin: 0;',
            '  width: max-content;',
            '}',
            '.arkdle-share-capture-host .oper-item .arkdle-share-arrow--down {',
            '  position: absolute !important;',
            '  top: 80%;',
            '  left: 50%;',
            '  transform: translate(-50%, -50%);',
            '  display: block;',
            '  line-height: 1;',
            '  font-size: 9px;',
            '  font-weight: 700;',
            '  color: #1a1a1a;',
            '  pointer-events: none;',
            '  margin: 0;',
            '  width: max-content;',
            '}',
            '@media (max-width: 768px) {',
            '  .arkdle-share-capture-host .oper-item .arkdle-share-arrow--up,',
            '  .arkdle-share-capture-host .oper-item .arkdle-share-arrow--down {',
            '    font-size: 6px;',
            '    transform: translate(-50%, -50%) scale(0.82);',
            '  }',
            '}',
        ].join('\n');
        host.appendChild(shareStripGlowStyle);

        applyShareOperCellPresentation(host, maskCells);
        return host;
    }

    function mountHiddenCaptureHost(host) {
        if (!host) return;
        host.classList.add('arkdle-share-capture-host--offscreen');
        host.setAttribute('aria-hidden', 'true');
        document.body.appendChild(host);
    }

    function cloneCaptureHostForExport(host) {
        if (!host) return null;
        const clone = host.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        return clone;
    }

    function syncExportHostLayoutFromSource(sourceHost, exportHost) {
        if (!sourceHost || !exportHost || !sourceHost.ownerDocument) return;
        try {
            const win = sourceHost.ownerDocument.defaultView || window;
            const rect = sourceHost.getBoundingClientRect();
            const sourceStyle = win.getComputedStyle(sourceHost);
            if (rect.width > 0) {
                const widthPx = `${Math.round(rect.width)}px`;
                exportHost.style.width = widthPx;
                exportHost.style.maxWidth = widthPx;
                exportHost.style.minWidth = widthPx;
            }
            exportHost.style.padding = sourceStyle.padding;
            exportHost.style.marginLeft = sourceStyle.marginLeft;
            exportHost.style.marginRight = sourceStyle.marginRight;
            exportHost.style.background = sourceStyle.background;
            exportHost.style.boxSizing = sourceStyle.boxSizing;
        } catch (e) {
            /* ignore */
        }
    }

    function removeCaptureHost(host) {
        if (host && host.parentNode) {
            host.parentNode.removeChild(host);
        }
    }

    function clearPreparedLayout() {
        if (lastPreparedLayout) {
            removeCaptureHost(lastPreparedLayout);
            lastPreparedLayout = null;
        }
        if (!modalEl) return;
        const mount = modalEl.querySelector('#arkdle-share-layout-preview');
        if (mount) mount.replaceChildren();
    }

    function prepareInspectableLayout(maskCells) {
        clearPreparedLayout();
        const mount = modalEl ? modalEl.querySelector('#arkdle-share-layout-preview') : null;
        if (!mount) return null;
        const shell = document.createElement('div');
        shell.className = 'arkdle-share-modal__layout-shell';
        const host = buildCaptureHost(maskCells);
        host.removeAttribute('aria-hidden');
        shell.appendChild(host);
        mount.appendChild(shell);
        lastPreparedLayout = host;
        return host;
    }

    function setModalLayoutVisibility(visible) {
        if (!modalEl) return;
        const layoutStep = modalEl.querySelector('#arkdle-share-step-layout');
        if (layoutStep) layoutStep.hidden = !visible;
    }

    /** html2canvas 1.x 无法解析 color-mix()/color() 等；检测序列化后的颜色串 */
    function looksLikeUnsupportedColorCss(str) {
        if (!str || str === 'none' || str === 'auto' || str === 'transparent') return false;
        return /color-mix\b|\bcolor\s*\(|oklab\b|oklch\b|\blab\s*\(|\blch\s*\(|\bhwb\s*\(/i.test(str);
    }

    /**
     * 在 html2canvas 的克隆文档里去掉 body 上的 color-mix 背景（仍会随样式表进入克隆 iframe）。
     */
    function fixCloneDocumentForHtml2Canvas(clonedDoc) {
        if (!clonedDoc || !clonedDoc.head) return;
        const style = clonedDoc.createElement('style');
        style.setAttribute('data-arkdle-html2canvas-fix', '1');
        style.textContent = [
            'html { background-color:#f6f8fb !important; background-image:none !important; }',
            'body { background-color:#f6f8fb !important; background-image:none !important; }',
            'body::before, body::after { content:none !important; display:none !important;',
            'background:none !important; background-image:none !important; }'
        ].join(' ');
        clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild);
    }

    function assignSnapshotIds(root) {
        if (!root) return;
        let i = 1;
        root.setAttribute('data-arkdle-snap-id', String(i++));
        root.querySelectorAll('*').forEach((el) => {
            el.setAttribute('data-arkdle-snap-id', String(i++));
        });
    }

    /**
     * 将主文档中已解析的计算样式写回克隆节点，避免 html2canvas 去解析样式表里的不兼容语法导致降级。
     * 使用 data-arkdle-snap-id 映射，避免前序遍历顺序不一致引起样式串位。
     */
    function snapshotComputedStylesOntoCloneById(originalRoot, clonedRoot) {
        if (!originalRoot || !clonedRoot) return;
        const win = originalRoot.ownerDocument && originalRoot.ownerDocument.defaultView
            ? originalRoot.ownerDocument.defaultView
            : window;

        const cloneMap = new Map();
        [clonedRoot, ...clonedRoot.querySelectorAll('[data-arkdle-snap-id]')].forEach((el) => {
            const id = el.getAttribute && el.getAttribute('data-arkdle-snap-id');
            if (id) cloneMap.set(id, el);
        });

        const oList = [originalRoot, ...originalRoot.querySelectorAll('[data-arkdle-snap-id]')];
        oList.forEach((o) => {
            const id = o.getAttribute && o.getAttribute('data-arkdle-snap-id');
            if (!id) return;
            const c = cloneMap.get(id);
            if (!c) return;

            const cs = win.getComputedStyle(o);

            let bgc = cs.backgroundColor;
            if (looksLikeUnsupportedColorCss(bgc)) bgc = '#00000000';
            c.style.backgroundColor = bgc;

            let col = cs.color;
            if (looksLikeUnsupportedColorCss(col)) col = '#333333';
            c.style.color = col;

            ['Top', 'Right', 'Bottom', 'Left'].forEach((side) => {
                const colorKey = `border${side}Color`;
                const styleKey = `border${side}Style`;
                const widthKey = `border${side}Width`;

                let colorV = cs[colorKey];
                if (colorV && looksLikeUnsupportedColorCss(colorV)) colorV = '#00000059';

                const styleV = cs[styleKey];
                const widthV = cs[widthKey];

                if (widthV && widthV !== '0px' && styleV && styleV !== 'none') {
                    if (colorV) c.style[colorKey] = colorV;
                    c.style[styleKey] = styleV;
                    c.style[widthKey] = widthV;
                }
            });

            const br = cs.borderRadius;
            if (br && br !== '0px' && !looksLikeUnsupportedColorCss(br)) {
                c.style.borderRadius = br;
            }

            const bgi = cs.backgroundImage;
            if (bgi && bgi !== 'none' && looksLikeUnsupportedColorCss(bgi)) {
                c.style.backgroundImage = 'none';
            }

            const bs = cs.boxShadow;
            if (bs && bs !== 'none' && looksLikeUnsupportedColorCss(bs)) {
                c.style.boxShadow = 'none';
            }

            const ts = cs.textShadow;
            if (ts && ts !== 'none' && looksLikeUnsupportedColorCss(ts)) {
                c.style.textShadow = 'none';
            }

            const oc = cs.outlineColor;
            if (oc && looksLikeUnsupportedColorCss(oc)) {
                c.style.outlineColor = 'transparent';
            }

            const os = cs.outlineStyle;
            const ow = cs.outlineWidth;
            if (os && os !== 'none' && ow && ow !== '0px') {
                c.style.outlineStyle = os;
                c.style.outlineWidth = ow;
            }
        });
    }

    function todayStrForFile() {
        if (typeof window.getTodayStr === 'function') {
            try {
                return window.getTodayStr();
            } catch (e) {
                /* ignore */
            }
        }
        return new Date().toISOString().slice(0, 10);
    }

    function downloadCanvasAsDailySharePng(canvas) {
        const name = `arkdle-daily-${todayStrForFile()}.png`;
        const a = document.createElement('a');
        a.download = name;
        a.href = canvas.toDataURL('image/png');
        a.click();
    }

    function canvasToPngBlob(canvas) {
        return new Promise((resolve, reject) => {
            try {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('无法导出 PNG'));
                }, 'image/png');
            } catch (e) {
                reject(e);
            }
        });
    }

    async function copyCanvasPngToClipboard(canvas) {
        if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
            throw new Error('CLIPBOARD_UNSUPPORTED');
        }
        const blob = await canvasToPngBlob(canvas);
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
        ]);
    }

    function closeShareModal() {
        if (!modalEl) return;
        modalEl.hidden = true;
        document.body.classList.remove('arkdle-share-modal-open');
        lastCanvas = null;
        clearPreparedLayout();
        const img = modalEl.querySelector('#arkdle-share-modal-img');
        if (img) img.removeAttribute('src');
        const result = modalEl.querySelector('#arkdle-share-step-result');
        if (result) result.hidden = true;
        const st = modalEl.querySelector('#arkdle-share-modal-status');
        if (st) {
            st.textContent = '';
            st.classList.remove('arkdle-share-modal__status--ok');
        }
    }

    function ensureSharePreviewModal() {
        if (modalEl) return modalEl;

        modalEl = document.createElement('div');
        modalEl.id = 'arkdle-share-modal';
        modalEl.className = 'arkdle-share-modal';
        modalEl.hidden = true;
        modalEl.setAttribute('role', 'dialog');
        modalEl.setAttribute('aria-modal', 'true');
        modalEl.setAttribute('aria-labelledby', 'arkdle-share-modal-title');

        modalEl.innerHTML = [
            '<div class="arkdle-share-modal__backdrop" data-close="1"></div>',
            '<div class="arkdle-share-modal__panel" role="document">',
            '  <div class="arkdle-share-modal__header">',
            '    <h2 id="arkdle-share-modal-title" class="arkdle-share-modal__title">截图分享</h2>',
            '    <button type="button" class="arkdle-share-modal__close" aria-label="关闭">&times;</button>',
            '  </div>',
            '  <div class="arkdle-share-modal__status" id="arkdle-share-modal-status"></div>',
            '  <div id="arkdle-share-step-layout" class="arkdle-share-step">',
            '    <p class="arkdle-share-modal__hint" id="arkdle-share-modal-hint"></p>',
            '    <p class="arkdle-share-modal__subhint">以下区域会先按截图模块可实现的布局进行渲染，便于直接检查样式问题。</p>',
            '    <div class="arkdle-share-modal__layout-wrap">',
            '      <div class="arkdle-share-modal__layout-preview" id="arkdle-share-layout-preview"></div>',
            '    </div>',
            '    <div class="arkdle-share-modal__actions arkdle-share-modal__actions--primary">',
            '      <button type="button" class="btn-base" id="arkdle-share-btn-generate">生成截图</button>',
            '    </div>',
            '  </div>',
            '  <div id="arkdle-share-step-result" class="arkdle-share-step" hidden>',
            '    <p class="arkdle-share-modal__hint arkdle-share-modal__hint--compact" id="arkdle-share-modal-result-hint"></p>',
            '    <div class="arkdle-share-modal__preview-wrap">',
            '      <img class="arkdle-share-modal__preview" id="arkdle-share-modal-img" alt="分享预览" />',
            '    </div>',
            '    <div class="arkdle-share-modal__actions">',
            '      <button type="button" class="btn-base" id="arkdle-share-btn-download-screenshot">下载截图</button>',
            '      <button type="button" class="btn-base" id="arkdle-share-btn-save-image">保存图片</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');

        document.body.appendChild(modalEl);

        modalEl.querySelector('.arkdle-share-modal__backdrop').addEventListener('click', closeShareModal);
        modalEl.querySelector('.arkdle-share-modal__close').addEventListener('click', closeShareModal);

        const doDownload = () => {
            if (!lastCanvas) return;
            try {
                downloadCanvasAsDailySharePng(lastCanvas);
            } catch (e) {
                console.error(e);
                alert('下载失败，请重试。');
            }
        };

        const doCopyToClipboard = async () => {
            if (!lastCanvas) return;
            const st = modalEl.querySelector('#arkdle-share-modal-status');
            try {
                await copyCanvasPngToClipboard(lastCanvas);
                if (st) {
                    st.textContent = '已复制到剪贴板';
                    st.classList.add('arkdle-share-modal__status--ok');
                }
            } catch (e) {
                console.error(e);
                const tip = e && e.message === 'CLIPBOARD_UNSUPPORTED'
                    ? '当前环境不支持将图片写入剪贴板，请使用「下载截图」保存到本地。'
                    : '复制到剪贴板失败（需 HTTPS 或 localhost，并允许剪贴板权限）。可改用「下载截图」。';
                alert(tip);
            }
        };

        modalEl.querySelector('#arkdle-share-btn-download-screenshot').addEventListener('click', doDownload);
        modalEl.querySelector('#arkdle-share-btn-save-image').addEventListener('click', () => {
            doCopyToClipboard();
        });
        modalEl.querySelector('#arkdle-share-btn-generate').addEventListener('click', () => {
            runDailyMaskedScreenshotShare();
        });

        return modalEl;
    }

    function openDailyMaskedScreenshotShareModal() {
        if (window.arkdleGuessCacheMode === 'random') {
            alert('截图分享仅适用于「今日题目」通关后。');
            return;
        }

        const modal = ensureSharePreviewModal();
        setModalLayoutVisibility(true);
        const st = modal.querySelector('#arkdle-share-modal-status');
        const stepResult = modal.querySelector('#arkdle-share-step-result');
        const img = modal.querySelector('#arkdle-share-modal-img');
        const genBtn = modal.querySelector('#arkdle-share-btn-generate');
        const dlBtn = modal.querySelector('#arkdle-share-btn-download-screenshot');
        const saveBtn = modal.querySelector('#arkdle-share-btn-save-image');

        lastCanvas = null;
        if (img) img.removeAttribute('src');
        if (stepResult) stepResult.hidden = true;
        if (st) {
            st.textContent = '已创建可检查的截图布局，请先确认样式，再点击“生成截图”。';
            st.classList.remove('arkdle-share-modal__status--ok');
        }
        if (genBtn) genBtn.disabled = false;
        if (dlBtn) dlBtn.disabled = true;
        if (saveBtn) saveBtn.disabled = true;

        modal.hidden = false;
        document.body.classList.add('arkdle-share-modal-open');

        const hintEl = modal.querySelector('#arkdle-share-modal-hint');
        const resultHintEl = modal.querySelector('#arkdle-share-modal-result-hint');
        if (hintEl) hintEl.textContent = getSharePreviewHintText();
        if (resultHintEl) resultHintEl.textContent = '下方为根据当前检查布局生成的实际截图结果。';
        prepareInspectableLayout(true);
    }

    async function runDirectDailyScreenshotShare() {
        if (window.arkdleGuessCacheMode === 'random') {
            alert('截图分享仅适用于「今日题目」通关后。');
            return;
        }
        if (shareInProgress) return;
        shareInProgress = true;

        const footerBtn = document.getElementById('btn-daily-screenshot-share');
        if (footerBtn) {
            footerBtn.disabled = true;
            footerBtn.setAttribute('aria-busy', 'true');
        }

        const modal = ensureSharePreviewModal();
        setModalLayoutVisibility(false);
        const st = modal.querySelector('#arkdle-share-modal-status');
        const stepResult = modal.querySelector('#arkdle-share-step-result');
        const img = modal.querySelector('#arkdle-share-modal-img');
        const dlBtn = modal.querySelector('#arkdle-share-btn-download-screenshot');
        const saveBtn = modal.querySelector('#arkdle-share-btn-save-image');

        lastCanvas = null;
        if (img) img.removeAttribute('src');
        if (stepResult) stepResult.hidden = true;
        if (st) {
            st.textContent = '正在生成截图…';
            st.classList.remove('arkdle-share-modal__status--ok');
        }
        if (dlBtn) dlBtn.disabled = true;
        if (saveBtn) saveBtn.disabled = true;

        modal.hidden = false;
        document.body.classList.add('arkdle-share-modal-open');

        const hintEl = modal.querySelector('#arkdle-share-modal-hint');
        const resultHintEl = modal.querySelector('#arkdle-share-modal-result-hint');
        if (hintEl) hintEl.textContent = '';
        if (resultHintEl) resultHintEl.textContent = '下方为生成的实际截图结果。';

        let tmpSource = null;
        try {
            tmpSource = buildCaptureHost(true);
            mountHiddenCaptureHost(tmpSource);
            const canvas = await runCaptureToCanvas(tmpSource);
            lastCanvas = canvas;
            if (img) img.src = canvas.toDataURL('image/png');
            if (stepResult) stepResult.hidden = false;
            if (st) st.textContent = '';
        } catch (e) {
            console.error('[截图分享]', e);
            const tip = getScreenshotApiUrl()
                ? '生成分享图失败，请确认截图服务已启动且 window.ARKDLE_SCREENSHOT_API 配置正确。'
                : '生成分享图失败，请确认已存在文件 js/tools/html2canvas.min.js 后重试。';
            if (st) st.textContent = tip;
        } finally {
            if (tmpSource) removeCaptureHost(tmpSource);
            shareInProgress = false;
            if (footerBtn) {
                footerBtn.disabled = false;
                footerBtn.removeAttribute('aria-busy');
            }
            if (dlBtn) dlBtn.disabled = !lastCanvas;
            if (saveBtn) saveBtn.disabled = !lastCanvas;
        }
    }

    async function runDailyMaskedScreenshotShare() {
        if (window.arkdleGuessCacheMode === 'random') {
            alert('截图分享仅适用于「今日题目」通关后。');
            return;
        }
        if (shareInProgress) return;
        if (!lastPreparedLayout) {
            openDailyMaskedScreenshotShareModal();
            return;
        }
        shareInProgress = true;

        const footerBtn = document.getElementById('btn-daily-screenshot-share');
        if (footerBtn) {
            footerBtn.disabled = true;
            footerBtn.setAttribute('aria-busy', 'true');
        }

        const modal = ensureSharePreviewModal();
        const st = modal.querySelector('#arkdle-share-modal-status');
        const stepResult = modal.querySelector('#arkdle-share-step-result');
        const img = modal.querySelector('#arkdle-share-modal-img');
        const genBtn = modal.querySelector('#arkdle-share-btn-generate');
        const dlBtn = modal.querySelector('#arkdle-share-btn-download-screenshot');
        const saveBtn = modal.querySelector('#arkdle-share-btn-save-image');

        lastCanvas = null;
        if (img) img.removeAttribute('src');
        if (stepResult) stepResult.hidden = true;
        if (st) {
            st.textContent = '正在根据当前检查布局生成截图…';
            st.classList.remove('arkdle-share-modal__status--ok');
        }
        if (genBtn) genBtn.disabled = true;
        if (dlBtn) dlBtn.disabled = true;
        if (saveBtn) saveBtn.disabled = true;

        try {
            const canvas = await runCaptureToCanvas(lastPreparedLayout);
            lastCanvas = canvas;
            if (img) img.src = canvas.toDataURL('image/png');
            if (stepResult) stepResult.hidden = false;
            if (st) st.textContent = '';
        } catch (e) {
            console.error('[截图分享]', e);
            const tip = getScreenshotApiUrl()
                ? '生成分享图失败，请确认截图服务已启动且 window.ARKDLE_SCREENSHOT_API 配置正确。'
                : '生成分享图失败，请确认已存在文件 js/tools/html2canvas.min.js 后重试。';
            if (st) st.textContent = tip;
        } finally {
            shareInProgress = false;
            if (footerBtn) {
                footerBtn.disabled = false;
                footerBtn.removeAttribute('aria-busy');
            }
            if (genBtn) genBtn.disabled = false;
            if (dlBtn) dlBtn.disabled = !lastCanvas;
            if (saveBtn) saveBtn.disabled = !lastCanvas;
        }
    }

    async function runCaptureToCanvas(sourceHost) {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready.catch(() => {});
        }

        const exportHost = cloneCaptureHostForExport(sourceHost);
        if (!exportHost) {
            throw new Error('未找到可导出的截图布局');
        }
        syncExportHostLayoutFromSource(sourceHost, exportHost);

        if (getScreenshotApiUrl()) {
            try {
                mountHiddenCaptureHost(exportHost);
                prepareHostForServerExport(exportHost);
                const blob = await requestServerScreenshotPng(exportHost);
                return await blobPngToCanvas(blob);
            } finally {
                removeCaptureHost(exportHost);
            }
        }

        const html2canvas = await loadHtml2CanvasOnce();
        try {
            mountHiddenCaptureHost(exportHost);
            assignSnapshotIds(exportHost);
            const canvas = await html2canvas(exportHost, {
                scale: 2,
                backgroundColor: '#f6f8fb',
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                onclone(clonedDoc, clonedEl) {
                    try {
                        fixCloneDocumentForHtml2Canvas(clonedDoc);
                        snapshotComputedStylesOntoCloneById(exportHost, clonedEl);
                    } catch (err) {
                        console.warn('[截图分享] onclone 样式修正失败', err);
                    }
                }
            });
            return canvas;
        } finally {
            removeCaptureHost(exportHost);
        }
    }

    function initDailyWinScreenshotShare() {
        const btn = document.getElementById('btn-daily-screenshot-share');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (isScreenshotEditPreviewMode()) {
                openDailyMaskedScreenshotShareModal();
            } else {
                runDirectDailyScreenshotShare();
            }
        });
    }

    window.showArkdleDailyScreenshotShareButton = function showArkdleDailyScreenshotShareButton() {
        if (window.arkdleGuessCacheMode === 'random') return;
        const btn = document.getElementById('btn-daily-screenshot-share');
        if (btn) btn.hidden = false;
    };

    window.hideArkdleDailyScreenshotShareButton = function hideArkdleDailyScreenshotShareButton() {
        const btn = document.getElementById('btn-daily-screenshot-share');
        if (btn) btn.hidden = true;
    };

    initDailyWinScreenshotShare();
})();
