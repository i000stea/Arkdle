<script setup lang="ts">
/**
 * ScreenshotShareModal - 截图分享弹窗（迁移自 daily_win_screenshot_share.js 的弹窗结构）
 * 布局预览由 composable 在 open() 时构建（克隆主界面 DOM + 遮蔽）。
 */
import { useScreenshotShare } from '../composables/useScreenshotShare'

const share = useScreenshotShare()
const state = share.state.value
</script>

<template>
  <div
    v-if="state.visible"
    id="arkdle-share-modal"
    class="arkdle-share-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="arkdle-share-modal-title"
  >
    <div class="arkdle-share-modal__backdrop" @click="share.close()"></div>
    <div class="arkdle-share-modal__panel" role="document">
      <div class="arkdle-share-modal__header">
        <h2 id="arkdle-share-modal-title" class="arkdle-share-modal__title">截图分享</h2>
        <button type="button" class="arkdle-share-modal__close" aria-label="关闭" @click="share.close()">&times;</button>
      </div>
      <div class="arkdle-share-modal__status" :class="{ 'arkdle-share-modal__status--ok': state.statusOk }">
        {{ state.statusText }}
      </div>

      <!-- 布局检查步骤 -->
      <div v-if="state.step === 'layout'" id="arkdle-share-step-layout" class="arkdle-share-step">
        <p class="arkdle-share-modal__hint" id="arkdle-share-modal-hint">预览如下（方格遮蔽）；图片仅在本地生成，不会上传。</p>
        <p class="arkdle-share-modal__subhint">以下区域会先按截图模块可实现的布局进行渲染，便于直接检查样式问题。</p>
        <div class="arkdle-share-modal__layout-wrap">
          <div class="arkdle-share-modal__layout-preview" id="arkdle-share-layout-preview"></div>
        </div>
        <div class="arkdle-share-modal__actions arkdle-share-modal__actions--primary">
          <button type="button" class="btn-base" id="arkdle-share-btn-generate" :disabled="state.generating" @click="share.generate()">
            {{ state.generating ? '生成中…' : '生成截图' }}
          </button>
        </div>
      </div>

      <!-- 结果步骤 -->
      <div v-else id="arkdle-share-step-result" class="arkdle-share-step">
        <p class="arkdle-share-modal__hint arkdle-share-modal__hint--compact" id="arkdle-share-modal-result-hint">下方为根据当前检查布局生成的实际截图结果。</p>
        <div class="arkdle-share-modal__preview-wrap">
          <img class="arkdle-share-modal__preview" id="arkdle-share-modal-img" alt="分享预览" :src="state.previewSrc">
        </div>
        <div class="arkdle-share-modal__actions">
          <button type="button" class="btn-base" id="arkdle-share-btn-download-screenshot" @click="share.download()">下载截图</button>
          <button type="button" class="btn-base" id="arkdle-share-btn-save-image" @click="share.copyToClipboard()">保存图片</button>
        </div>
      </div>
    </div>
  </div>
</template>
