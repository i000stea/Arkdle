/**
 * 粥友出题包服务（迁移自 js/question_mode.js 的 fetchQuizPack）
 * 交互：POST { action: 'lookup', key } → SetQuestion/api.php
 */

export interface QuizQuestion {
  targetText: string
  hints?: string[] | string
  maxGuesses?: number | null
  allowRabbitHead?: boolean
  hintRevealAfterAttempt?: number | null
}

export interface QuizPack {
  authorNickname?: string
  authorMessage?: string
  questions: QuizQuestion[]
  legacy?: boolean
}

const QUIZ_API_BASE = (() => {
  try {
    return new URL('/SetQuestion/api.php', window.location.origin).toString()
  } catch {
    return '/SetQuestion/api.php'
  }
})()

/** 按 Key 拉取题包 */
export async function fetchQuizPack(key: string): Promise<QuizPack> {
  const res = await fetch(QUIZ_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'lookup', key }),
  })

  const rawText = await res.text()
  let data: { status?: string; message?: string; data?: QuizPack } | null = null
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error('题包加载失败：接口返回非 JSON（可能路径不对或 404/500）')
  }

  if (!data || data.status !== 'success') {
    throw new Error((data?.message ? data.message : '题包加载失败（服务器返回失败）') + ` [HTTP ${res.status}]`)
  }
  if (data.data?.legacy) {
    throw new Error('该 Key 为旧版文本记录，无法用于粥友出题')
  }
  return data.data as QuizPack
}
