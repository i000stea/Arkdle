<script setup lang="ts">
/**
 * GuessBoard - 猜测棋盘（表头 + 历史行 + 预览行）
 * 渲染完全由 store 驱动：历史来自 guessHistory，预览来自 previewOperator。
 * 表头同样支持兔头模式关闭时的重排（与原版 syncRabbitModeGrid 一致）。
 */
import { computed, watch, nextTick } from 'vue'
import GuessRow from './GuessRow.vue'
import { COLUMNS } from '../types/operator'
import type { ColumnDef } from '../types/operator'
import { useGameStore } from '../stores/game'
import { useDataStore } from '../stores/data'
import { useAppStore } from '../stores/app'

const gameStore = useGameStore()
const dataStore = useDataStore()
const appStore = useAppStore()

// 滚动容器在 App 模板中（.scroll-container），此处直接查询
function scrollToLatest(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('.scroll-container')
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    })
  })
}

// 历史行或预览行变化时滚动到最新一行（双 rAF 与旧版一致，等待布局完成）
watch(
  () => [gameStore.guessHistory.length, gameStore.previewOperator],
  () => nextTick(scrollToLatest),
)

// 表头兔头关闭重排
const rabbitOff = computed(() => !appStore.rabbitModeEnabled)
const nonRabbitSeq = new Map<string, number>()
{
  let seq = 0
  COLUMNS.forEach((col) => {
    if (!col.rabbitStat) {
      seq += 1
      nonRabbitSeq.set(col.key, seq)
    }
  })
}

const headClass = (col: ColumnDef): string[] => {
  const cls: string[] = ['guessing-head']
  if (col.rabbitStat) cls.push('rabbit-stat')
  return cls
}

const headStyle = (col: ColumnDef): Record<string, string> => {
  if (!rabbitOff.value) return {}
  if (col.rabbitStat) return { display: 'none' }
  return { gridColumn: String(nonRabbitSeq.get(col.key) ?? 1) }
}
</script>

<template>
  <div class="guessing">
    <div class="guessing-item guessing-heads">
      <div id="guessing-head" class="guessing-info" :class="{ 'guessing-info--compact': rabbitOff }">
        <div
          v-for="col in COLUMNS"
          :key="col.key"
          :class="headClass(col)"
          :style="headStyle(col)"
        >
          {{ col.label }}
        </div>
      </div>
    </div>
    <div id="guessing-items" class="guessing-item">
      <GuessRow
        v-for="(row, i) in gameStore.guessHistory"
        :key="`${row.name}-${i}`"
        :guess="row.data"
        :target="gameStore.targetOperator"
        :fuzzy="dataStore.fuzzyItemData"
        :animate="i === gameStore.guessHistory.length - 1"
      />
      <GuessRow v-if="gameStore.previewOperator" :guess="gameStore.previewOperator" />
    </div>
  </div>
</template>
