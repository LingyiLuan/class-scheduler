import { callFunction } from './api'

/**
 * 调试用：手动触发发送，真机上即时验证订阅消息，无需等 10 分钟定时器。
 * 仅在开发环境的首页调试入口调用。发给调用者自己。
 * state：'developer' 真机调试(开发版) / 'trial' 体验版 / 'formal' 正式版，须与当前测试的小程序版本一致。
 */
export interface DebugSendResult {
  sent: number
  total?: number
  note?: string
  results?: Array<{ sessionId?: string; ok: boolean; errCode: number; errMsg?: string }>
  result?: { ok: boolean; errCode: number; errMsg?: string }
}

export function debugSendClassReminder(state = 'developer'): Promise<DebugSendResult> {
  return callFunction('reminders', { action: 'debugSendClassReminder', data: { state } }, { loading: '发送中' })
}

export function debugSendLowCredit(state = 'developer'): Promise<DebugSendResult> {
  return callFunction('reminders', { action: 'debugSendLowCredit', data: { state } }, { loading: '发送中' })
}
