/**
 * 右侧纯文字「更新日志」入口；点击后以居中模态弹窗展示 CHANGELOG.md。
 */
(function changelogModalIIFE() {
    const CHANGELOG_URL = 'CHANGELOG.md';

    let modalEl = null;
    let triggerEl = null;
    let cachedHtml = null;
    let loadPromise = null;

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function inlineMarkdown(text) {
        return escapeHtml(text)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }

    function markdownChangelogToHtml(md) {
        const lines = md.replace(/\r\n/g, '\n').split('\n');
        const parts = [];
        let inList = false;
        let listTag = 'ul';

        function closeList() {
            if (inList) {
                parts.push(`</${listTag}>`);
                inList = false;
            }
        }

        for (const raw of lines) {
            const trimmed = raw.trim();

            if (trimmed === '---') {
                closeList();
                parts.push('<hr class="arkdle-changelog__hr">');
                continue;
            }

            if (trimmed.startsWith('### ')) {
                closeList();
                parts.push(`<h3 class="arkdle-changelog__h3">${inlineMarkdown(trimmed.slice(4))}</h3>`);
                continue;
            }

            if (trimmed.startsWith('## ')) {
                closeList();
                parts.push(`<h2 class="arkdle-changelog__h2">${inlineMarkdown(trimmed.slice(3))}</h2>`);
                continue;
            }

            if (trimmed.startsWith('# ')) {
                closeList();
                parts.push(`<h1 class="arkdle-changelog__h1">${inlineMarkdown(trimmed.slice(2))}</h1>`);
                continue;
            }

            if (trimmed.startsWith('- ')) {
                if (!inList || listTag !== 'ul') {
                    closeList();
                    listTag = 'ul';
                    parts.push('<ul class="arkdle-changelog__list">');
                    inList = true;
                }
                parts.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
                continue;
            }

            if (/^\d+\.\s/.test(trimmed)) {
                if (!inList || listTag !== 'ol') {
                    closeList();
                    listTag = 'ol';
                    parts.push('<ol class="arkdle-changelog__list arkdle-changelog__list--ordered">');
                    inList = true;
                }
                parts.push(`<li>${inlineMarkdown(trimmed.replace(/^\d+\.\s/, ''))}</li>`);
                continue;
            }

            if (!trimmed) {
                closeList();
                continue;
            }

            closeList();
            parts.push(`<p class="arkdle-changelog__p">${inlineMarkdown(trimmed)}</p>`);
        }

        closeList();
        return parts.join('\n');
    }

    function closeChangelogModal() {
        if (!modalEl) return;
        modalEl.hidden = true;
        document.body.classList.remove('arkdle-changelog-modal-open');
        if (triggerEl) {
            triggerEl.setAttribute('aria-expanded', 'false');
            triggerEl.classList.remove('arkdle-changelog-trigger--open');
        }
    }

    function ensureChangelogModal() {
        if (modalEl) return modalEl;

        modalEl = document.createElement('div');
        modalEl.id = 'arkdle-changelog-modal';
        modalEl.className = 'arkdle-changelog-modal';
        modalEl.hidden = true;
        modalEl.setAttribute('role', 'dialog');
        modalEl.setAttribute('aria-modal', 'true');
        modalEl.setAttribute('aria-labelledby', 'arkdle-changelog-modal-title');

        modalEl.innerHTML = [
            '<div class="arkdle-changelog-modal__backdrop" data-close="1"></div>',
            '<div class="arkdle-changelog-modal__panel" role="document">',
            '  <div class="arkdle-changelog-modal__header">',
            '    <h2 id="arkdle-changelog-modal-title" class="arkdle-changelog-modal__title">更新日志</h2>',
            '    <button type="button" class="arkdle-changelog-modal__close" aria-label="关闭">&times;</button>',
            '  </div>',
            '  <div class="arkdle-changelog-modal__body" id="arkdle-changelog-modal-body">',
            '    <p class="arkdle-changelog-modal__loading">正在加载…</p>',
            '  </div>',
            '</div>',
        ].join('');

        document.body.appendChild(modalEl);

        modalEl.querySelector('.arkdle-changelog-modal__backdrop').addEventListener('click', closeChangelogModal);
        modalEl.querySelector('.arkdle-changelog-modal__close').addEventListener('click', closeChangelogModal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalEl && !modalEl.hidden) {
                closeChangelogModal();
            }
        });

        return modalEl;
    }

    async function loadChangelogHtml() {
        if (cachedHtml) return cachedHtml;
        if (loadPromise) return loadPromise;

        loadPromise = (async () => {
            const res = await fetch(CHANGELOG_URL, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const md = await res.text();
            cachedHtml = markdownChangelogToHtml(md);
            return cachedHtml;
        })();

        try {
            return await loadPromise;
        } catch (e) {
            loadPromise = null;
            throw e;
        }
    }

    async function openChangelogModal() {
        const modal = ensureChangelogModal();
        const body = modal.querySelector('#arkdle-changelog-modal-body');
        body.innerHTML = '<p class="arkdle-changelog-modal__loading">正在加载…</p>';
        modal.hidden = false;
        document.body.classList.add('arkdle-changelog-modal-open');
        if (triggerEl) {
            triggerEl.setAttribute('aria-expanded', 'true');
            triggerEl.classList.add('arkdle-changelog-trigger--open');
        }

        try {
            const html = await loadChangelogHtml();
            body.innerHTML = `<div class="arkdle-changelog">${html}</div>`;
        } catch (e) {
            body.innerHTML = '<p class="arkdle-changelog-modal__error">无法加载更新日志，请稍后重试。</p>';
            console.error('[更新日志]', e);
        }
    }

    function initChangelogModal() {
        triggerEl = document.getElementById('btn-changelog');
        if (!triggerEl) return;

        triggerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (modalEl && !modalEl.hidden) {
                closeChangelogModal();
            } else {
                openChangelogModal();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChangelogModal);
    } else {
        initChangelogModal();
    }
})();
