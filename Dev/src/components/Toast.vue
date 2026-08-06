<script setup lang="ts">
/**
 * Toast - 顶部吐司容器（配合 useToast 使用）
 */
import { useToast } from '../composables/useToast'

const { toasts } = useToast()
</script>

<template>
  <div class="arkdle-toast-host" aria-live="polite">
    <TransitionGroup name="arkdle-toast">
      <div v-for="t in toasts" :key="t.id" class="arkdle-toast">
        {{ t.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.arkdle-toast-host {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10080;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.arkdle-toast {
  background: rgba(30, 30, 34, 0.92);
  color: #fff;
  font-size: 0.9rem;
  padding: 10px 18px;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  max-width: 80vw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arkdle-toast-enter-active,
.arkdle-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.arkdle-toast-enter-from,
.arkdle-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
