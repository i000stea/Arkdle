<script setup lang="ts">
/**
 * TutorialModal - 游戏教程弹窗（迁移自 tutorial_view + Dev/index.html #teaching）
 * 内容为静态 4 步（无分步导航），动画/滚动锁由可见状态驱动。
 */
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useTutorialStore } from '../stores/tutorial'

const tutorial = useTutorialStore()

// CSS 动画：先渲染再追加 .show 触发淡入（与原版 show() 的 10ms 延迟一致）
const shown = ref(false)
watch(
  () => tutorial.visible,
  async (visible) => {
    document.body.style.overflow = visible ? 'hidden' : ''
    if (visible) {
      shown.value = false
      await nextTick()
      setTimeout(() => {
        shown.value = true
      }, 10)
    } else {
      shown.value = false
    }
  },
)

function close(): void {
  tutorial.close()
  tutorial.markShown()
}

// ESC 关闭（迁移 bindEscapeKey：全局监听，与可见状态联动）
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && tutorial.visible) close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.tutorial-step-icon {
  width: 1.2em;
  height: 1.2em;
  vertical-align: -0.2em;
}
</style>

<template>
  <div
    id="teaching"
    :style="{ display: tutorial.visible ? 'flex' : 'none' }"
    :class="{ show: shown }"
    @click.self="close"
  >
    <div class="teaching-content">
      <div class="teaching-header">
        <h1>游戏教程</h1>
        <button class="close-btn" id="close-teaching" @click="close">&times;</button>
      </div>

      <div class="teaching-body">
        <div class="tutorial-step active">
          <h2><img class="tutorial-step-icon" :src="'resource/icon/fireworks.svg'" alt="" aria-hidden="true"> 游戏目标</h2>
          <p>欢迎来到舟兜（Arkdle）！这是一个基于明日方舟的猜谜游戏。</p>
          <p>你需要在<strong>8次机会</strong>内猜出正确的干员名称。</p>
        </div>

        <hr class="tutorial-divider">

        <div class="tutorial-step">
          <h2><img class="tutorial-step-icon" :src="'resource/icon/game.svg'" alt="" aria-hidden="true"> 游戏规则</h2>
          <p>每次猜测后，系统会显示该干员的各项属性：</p>
          <ul>
            <li><strong>职业、生命、攻击、防御、法抗</strong> - 基础属性</li>
            <li><strong>再部署、费用、阻挡</strong> - 战斗属性</li>
            <li><strong>位置、势力、出身地、种族</strong> - 背景信息</li>
          </ul>
        </div>

        <hr class="tutorial-divider">

        <div class="tutorial-step">
          <h2><img class="tutorial-step-icon" :src="'resource/icon/tutorial.svg'" alt="" aria-hidden="true"> 颜色提示</h2>
          <div class="color-guide">
            <div class="color-item">
              <span class="color-box correct"></span>
              <span>绿色 - 完全正确</span>
            </div>
            <div class="color-item">
              <span class="color-box partialA"></span>
              <span>黄色 - 数值部分接近近似值</span>
            </div>
            <div class="color-item">
              <span class="color-box partialB"></span>
              <span>橙色 - 势力或种族部分模糊接近</span>
            </div>
            <div class="color-item">
              <span class="color-box wrong"></span>
              <span>灰色 - 完全错误</span>
            </div>
          </div>
        </div>

        <hr class="tutorial-divider">

        <div class="tutorial-step">
          <h2><img class="tutorial-step-icon" :src="'resource/icon/tips.svg'" alt="" aria-hidden="true"> 游戏技巧</h2>
          <ul>
            <li>输入时会有<strong>自动补全提示</strong>，帮助你快速选择干员</li>
            <li>可以点击<strong>"随机选择"</strong>按钮获得随机干员建议</li>
            <li>观察颜色提示，逐步缩小范围</li>
            <li>利用势力、出身地等信息进行逻辑推理</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
