import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { existsSync, createReadStream } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 项目根目录（生产部署后与构建产物同层，dev 下经此插件服务）
const PARENT_DIR = fileURLToPath(new URL('..', import.meta.url))
const RESOURCE_DIR = join(PARENT_DIR, 'resource')

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
}

/**
 * Dev 阶段：将 /resource/*、/CHANGELOG.md、/SetQuestion/* 请求映射到项目根目录。
 * 生产环境资源同层部署，此插件仅在 configureServer（dev）时生效。
 */
function serveParentResource(): Plugin {
  return {
    name: 'serve-parent-resource',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]

        let filePath: string | null = null
        if (url.startsWith('/resource/')) {
          const rel = url.slice('/resource/'.length)
          if (!/^[a-zA-Z0-9._\-/]+$/.test(rel)) return next()
          filePath = join(RESOURCE_DIR, rel)
        } else if (url === '/CHANGELOG.md') {
          filePath = join(PARENT_DIR, 'CHANGELOG.md')
        } else if (url === '/SetQuestion' || url === '/SetQuestion/') {
          // 目录请求 → 出题包编辑后台首页
          filePath = join(PARENT_DIR, 'SetQuestion', 'index.html')
        } else if (url.startsWith('/SetQuestion/')) {
          const rel = url.slice('/SetQuestion/'.length)
          if (!/^[a-zA-Z0-9._\-/]+$/.test(rel)) return next()
          filePath = join(PARENT_DIR, 'SetQuestion', rel)
        }

        if (filePath === null || !existsSync(filePath)) return next()
        const ext = filePath.slice(filePath.lastIndexOf('.'))
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
        createReadStream(filePath).pipe(res)
      })
    },
  }
}

// base: './' —— 相对路径，保证可部署到任意子目录（生产站 /Dev 或根目录）
export default defineConfig({
  plugins: [vue(), serveParentResource()],
  base: './',
  server: {
    port: 5173,
    fs: { allow: ['..'] },
  },
  build: {
    // 保证每次构建清空旧产物，避免旧 hash 文件残留
    emptyOutDir: true,
  },
})
