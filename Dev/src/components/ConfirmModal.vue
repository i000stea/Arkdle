<script setup lang="ts">
/**
 * ConfirmModal - 通用确认弹窗（配合 useConfirm）
 */
import { useConfirm } from '../composables/useConfirm'

const confirm = useConfirm()
</script>

<template>
  <div
    v-if="confirm.state.visible"
    class="arkdle-confirm-modal"
    role="dialog"
    aria-modal="true"
    @click.self="confirm.cancel()"
  >
    <div class="arkdle-confirm-modal__panel">
      <p class="arkdle-confirm-modal__message">{{ confirm.state.message }}</p>
      <div class="arkdle-confirm-modal__actions">
        <button type="button" class="btn-base" @click="confirm.cancel()">取消</button>
        <button type="button" class="btn-base" @click="confirm.confirm()">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arkdle-confirm-modal {
  position: fixed;
  inset: 0;
  z-index: 10070;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arkdle-confirm-modal::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.arkdle-confirm-modal__panel {
  position: relative;
  width: min(360px, 90vw);
  background: var(--ark-white-97, #f7f8fa);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  padding: 20px 22px;
}

.arkdle-confirm-modal__message {
  margin: 0 0 18px;
  font-size: 0.95rem;
  line-height: 1.5;
  color: #333;
}

.arkdle-confirm-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
