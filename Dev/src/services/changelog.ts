/**
 * 更新日志服务（迁移自 js/ui/changelog_modal.js 的 markdown 渲染）
 * 拉取 CHANGELOG.md 并转为安全的 HTML（inline 转义 + 链接/加粗）。
 */

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

/** 简易 markdown → HTML（支持标题/列表/hr/段落，迁移 markdownChangelogToHtml） */
export function markdownChangelogToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const parts: string[] = []
  let inList = false
  let listTag: 'ul' | 'ol' = 'ul'

  function closeList(): void {
    if (inList) {
      parts.push(`</${listTag}>`)
      inList = false
    }
  }

  for (const raw of lines) {
    const trimmed = raw.trim()

    if (trimmed === '---') {
      closeList()
      parts.push('<hr class="arkdle-changelog__hr">')
      continue
    }
    if (trimmed.startsWith('### ')) {
      closeList()
      parts.push(`<h3 class="arkdle-changelog__h3">${inlineMarkdown(trimmed.slice(4))}</h3>`)
      continue
    }
    if (trimmed.startsWith('## ')) {
      closeList()
      parts.push(`<h2 class="arkdle-changelog__h2">${inlineMarkdown(trimmed.slice(3))}</h2>`)
      continue
    }
    if (trimmed.startsWith('# ')) {
      closeList()
      parts.push(`<h1 class="arkdle-changelog__h1">${inlineMarkdown(trimmed.slice(2))}</h1>`)
      continue
    }
    if (trimmed.startsWith('- ')) {
      if (!inList || listTag !== 'ul') {
        closeList()
        listTag = 'ul'
        parts.push('<ul class="arkdle-changelog__list">')
        inList = true
      }
      parts.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`)
      continue
    }
    if (/^\d+\.\s/.test(trimmed)) {
      if (!inList || listTag !== 'ol') {
        closeList()
        listTag = 'ol'
        parts.push('<ol class="arkdle-changelog__list arkdle-changelog__list--ordered">')
        inList = true
      }
      parts.push(`<li>${inlineMarkdown(trimmed.replace(/^\d+\.\s/, ''))}</li>`)
      continue
    }
    if (!trimmed) {
      closeList()
      continue
    }

    closeList()
    parts.push(`<p class="arkdle-changelog__p">${inlineMarkdown(trimmed)}</p>`)
  }

  closeList()
  return parts.join('\n')
}

let cachedHtml: string | null = null
let loadPromise: Promise<string> | null = null

/** 拉取并渲染 CHANGELOG.md（带缓存） */
export async function loadChangelogHtml(): Promise<string> {
  if (cachedHtml) return cachedHtml
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}CHANGELOG.md`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const md = await res.text()
    cachedHtml = markdownChangelogToHtml(md)
    return cachedHtml
  })()

  try {
    return await loadPromise
  } catch (e) {
    loadPromise = null
    throw e
  }
}
