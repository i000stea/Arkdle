/**
 * 每日分享图：服务端 Playwright 渲染截图（参考无头浏览器方案）。
 *
 * 启动：npm install && npx playwright install chromium && npm run screenshot-server
 * 环境变量：
 *   ARKDLE_SCREENSHOT_PORT   默认 37521
 *   ARKDLE_SCREENSHOT_SECRET 若设置则请求头须带 X-Arkdle-Screenshot-Secret: 同值
 *
 * 前端配置：window.ARKDLE_SCREENSHOT_API = 'http://127.0.0.1:37521'（或通过反代同源路径）
 */
import http from 'node:http';
import { chromium } from 'playwright';

const PORT = Number(process.env.ARKDLE_SCREENSHOT_PORT || 37521);
const SECRET = (process.env.ARKDLE_SCREENSHOT_SECRET || '').trim();
const MAX_BODY = 6 * 1024 * 1024;

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Arkdle-Screenshot-Secret',
        'Access-Control-Max-Age': '86400',
    };
}

function isHttpUrl(s) {
    try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

function escapeAttr(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function filterCssHrefs(hrefs, baseUrl) {
    let origin;
    try {
        origin = new URL(baseUrl).origin;
    } catch {
        return [];
    }
    if (!Array.isArray(hrefs)) return [];
    return hrefs.filter((h) => {
        try {
            return new URL(h).origin === origin;
        } catch {
            return false;
        }
    });
}

function buildFullDocument({ htmlFragment, baseUrl, cssHrefs }) {
    const safeBase = escapeAttr(baseUrl);
    const links = cssHrefs
        .map((h) => `<link rel="stylesheet" href="${escapeAttr(h)}">`)
        .join('\n');
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">`
        + `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
        + `<base href="${safeBase}">${links}</head>`
        + `<body style="margin:0;background:#f6f8fb">${htmlFragment}</body></html>`;
}

async function readBody(req, maxBytes) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        total += chunk.length;
        if (total > maxBytes) {
            const err = new Error('PAYLOAD_TOO_LARGE');
            err.code = 'PAYLOAD_TOO_LARGE';
            throw err;
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

let browserPromise;
async function getBrowser() {
    if (!browserPromise) {
        browserPromise = chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    }
    return browserPromise;
}

async function renderPng(payload) {
    const {
        htmlFragment,
        baseUrl,
        cssHrefs: rawCss,
        selector = '.arkdle-share-capture-host',
        deviceScaleFactor: dsfRaw,
    } = payload;

    if (!htmlFragment || typeof htmlFragment !== 'string') {
        throw new Error('INVALID_BODY: missing htmlFragment');
    }
    if (!baseUrl || typeof baseUrl !== 'string' || !isHttpUrl(baseUrl)) {
        throw new Error('INVALID_BODY: baseUrl must be http(s)');
    }

    const baseNorm = new URL(baseUrl).href;
    const cssHrefs = filterCssHrefs(rawCss, baseNorm);
    const html = buildFullDocument({ htmlFragment, baseUrl: baseNorm, cssHrefs });

    let dsf = Number(dsfRaw);
    if (!Number.isFinite(dsf) || dsf < 1) dsf = 2;
    if (dsf > 3) dsf = 3;

    const browser = await getBrowser();
    const context = await browser.newContext({ deviceScaleFactor: dsf });
    try {
        const page = await context.newPage();
        await page.setViewportSize({ width: 1280, height: 2600 });
        await page.setContent(html, {
            url: baseNorm,
            waitUntil: 'load',
            timeout: 90000,
        });
        await page.evaluate(async () => {
            if (document.fonts && document.fonts.ready) {
                try {
                    await document.fonts.ready;
                } catch {
                    /* ignore */
                }
            }
        });
        await page.locator(selector).waitFor({ state: 'visible', timeout: 15000 });
        return await page.locator(selector).screenshot({
            type: 'png',
            animations: 'disabled',
        });
    } finally {
        await context.close();
    }
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST, OPTIONS', ...corsHeaders() });
        res.end('Method Not Allowed');
        return;
    }

    if (SECRET) {
        const sent = (req.headers['x-arkdle-screenshot-secret'] || '').trim();
        if (sent !== SECRET) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
            res.end('Forbidden');
            return;
        }
    }

    let bodyBuf;
    try {
        bodyBuf = await readBody(req, MAX_BODY);
    } catch (e) {
        if (e.code === 'PAYLOAD_TOO_LARGE') {
            res.writeHead(413, corsHeaders());
            res.end();
            return;
        }
        res.writeHead(400, corsHeaders());
        res.end();
        return;
    }

    let payload;
    try {
        payload = JSON.parse(bodyBuf.toString('utf8'));
    } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
        res.end('Invalid JSON');
        return;
    }

    try {
        const png = await renderPng(payload);
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-store',
            ...corsHeaders(),
        });
        res.end(png);
    } catch (e) {
        const msg = e && e.message ? String(e.message) : 'render failed';
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
        res.end(msg);
    }
});

server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[arkdle-screenshot] listening on http://127.0.0.1:${PORT} (POST /)`);
});

async function shutdown() {
    try {
        if (browserPromise) {
            const b = await browserPromise;
            await b.close();
        }
    } catch {
        /* ignore */
    }
    server.close();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
