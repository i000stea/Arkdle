<script setup lang="ts">
/**
 * Tooltip - 模糊/近似悬停浮窗（迁移自 tooltip_view）
 * 定位跟随鼠标，自动处理视口边界；渲染由 useTooltip 的响应式状态驱动。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useTooltip } from '../composables/useTooltip'

const { state } = useTooltip()

const hostRef = ref<HTMLElement | null>(null)
const pos = ref({ left: 0, top: 0 })

function position(): void {
  if (!state.visible || !hostRef.value) return
  const el = hostRef.value
  const offset = 14
  const vw = window.innerWidth
  const vh = window.innerHeight
  const rect = el.getBoundingClientRect()
  const w = rect.width || 300
  const h = rect.height || 80

  let left = state.x + offset
  let top = state.y + offset

  if (left + w > vw - 8) left = state.x - w - offset
  if (top + h > vh - 8) top = state.y - h - offset
  if (left < 8) left = 8
  if (top < 8) top = 8

  pos.value = { left, top }
}

// 内容变化（含首次显示）后重新定位
watch(
  () => [state.visible, state.type, state.fuzzyPayload, state.approxPayload],
  async () => {
    if (state.visible) {
      await nextTick()
      position()
    }
  },
  { deep: true },
)

// 跟随鼠标
function onMouseMove(e: MouseEvent): void {
  if (!state.visible) return
  state.x = e.clientX
  state.y = e.clientY
  position()
}

onMounted(() => document.addEventListener('mousemove', onMouseMove, { passive: true }))
onUnmounted(() => document.removeEventListener('mousemove', onMouseMove))
</script>

<template>
  <div ref="hostRef" class="arkdle-tooltip-host" :style="{ transform: `translate(${pos.left}px, ${pos.top}px)` }">
    <div
      v-if="state.visible && state.type === 'fuzzy'"
      id="fuzzy-match-tooltip"
      class="fuzzy-match-tooltip--visible"
      role="tooltip"
      aria-live="polite"
    >
      <p class="fuzzy-match-tooltip-intro">
        模糊命中，当前选择<strong class="fuzzy-match-tooltip-select">{{ state.fuzzyPayload?.select }}</strong>属于{{ state.fuzzyPayload?.parent }}。
      </p>
      <p class="fuzzy-match-tooltip-label">包括：</p>
      <ul class="fuzzy-match-tooltip-list">
        <li v-for="m in state.fuzzyPayload?.members ?? []" :key="m">
          <strong v-if="m === state.fuzzyPayload?.select" class="fuzzy-match-tooltip-select">{{ m }}</strong>
          <template v-else>{{ m }}</template>
        </li>
      </ul>
    </div>
    <div
      v-else-if="state.visible && state.type === 'approx'"
      id="approx-match-tooltip"
      class="approx-match-tooltip--visible"
      role="tooltip"
    >
      <p class="approx-match-tooltip-intro">
        数值 <span class="approx-match-tooltip-em">{{ state.approxPayload?.guessVal }}</span> 与目标干员数值相差在 {{ state.approxPayload?.tolerance }} 以内
      </p>
    </div>
  </div>
</template>

<style scoped>
.arkdle-tooltip-host {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  pointer-events: none;
}
</style>
