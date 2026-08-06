/**
 * 确认猜测组合式函数（迁移自 play_controller.handleConfirmClick）
 *
 * 职责：名称 → 干员数据 → store.confirm()，并触发胜利特效。
 * 视图副作用（提示条、滚动、按钮显隐）由组件 watch store 状态完成。
 */
import { useGameStore } from '../stores/game'
import { useDataStore } from '../stores/data'
import { useAppStore } from '../stores/app'
import { findOperatorByNameOrEnglish } from '../utils/guess'
import { playVictoryRibbon } from '../effects/victoryRibbons'
import { showFireworks } from '../effects/fireworks'
import type { Operator } from '../types/operator'
import type { ConfirmResult } from '../stores/game'

export function useConfirmGuess() {
  const gameStore = useGameStore()
  const dataStore = useDataStore()
  const appStore = useAppStore()

  function confirmOperator(op: Operator): ConfirmResult | null {
    // 清除预览行 + 清空输入框 + 清空输入状态，避免重复提交
    gameStore.setPreview(null)
    appStore.setInputName('')
    const input = document.querySelector<HTMLInputElement>('#input-name')
    if (input) input.value = ''

    const result = gameStore.confirm(op)
    if (result?.isVictory) {
      playVictoryRibbon()
      showFireworks()
    }
    return result
  }

  function confirmByName(name: string): ConfirmResult | null {
    if (gameStore.gameOver) return null
    const op = findOperatorByNameOrEnglish(dataStore.operatorsData, name)
    if (!op) return null
    return confirmOperator(op)
  }

  return { confirmOperator, confirmByName }
}
