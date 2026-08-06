<script setup lang="ts">
/**
 * ChangelogModal - 更新日志弹窗（迁移自 js/ui/changelog_modal.js）
 * 打开时拉取 CHANGELOG.md 并渲染；支持 ESC / 背景 / 关闭按钮关闭。
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { loadChangelogHtml } from '../services/changelog'

const visible = ref(false)
const html = ref('')
const loading = ref(false)
const error = ref(false)

let timer: ReturnType<typeof setTimeout> | null = null

function open(): void {
  visible.value = true
  if (html.value) return
  loading.value = true
  error.value = false
  loadChangelogHtml()
    .then((h) => {
      html.value = h
    })
    .catch((e) => {
      console.error('[更新日志]', e)
      error.value = true
    })
    .finally(() => {
      loading.value = false
    })
}

function close(): void {
  visible.value = false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && visible.value) close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  if (timer) clearTimeout(timer)
})

defineExpose({ open })
</script>

<template>
  <div v-if="visible" id="arkdle-changelog-modal" class="arkdle-changelog-modal" role="dialog" aria-modal="true" aria-labelledby="arkdle-changelog-modal-title">
    <div class="arkdle-changelog-modal__backdrop" @click="close"></div>
    <div class="arkdle-changelog-modal__panel" role="document">
      <div class="arkdle-changelog-modal__header">
        <h2 id="arkdle-changelog-modal-title" class="arkdle-changelog-modal__title">更新日志</h2>
        <button type="button" class="arkdle-changelog-modal__close" aria-label="关闭" @click="close">&times;</button>
      </div>
      <div class="arkdle-changelog-modal__body" id="arkdle-changelog-modal-body">
        <p v-if="loading" class="arkdle-changelog-modal__loading">正在加载…</p>
        <p v-else-if="error" class="arkdle-changelog-modal__error">无法加载更新日志，请稍后重试。</p>
        <div v-else class="arkdle-changelog" v-html="html"></div>
      </div>
    </div>
  </div>
</template>
