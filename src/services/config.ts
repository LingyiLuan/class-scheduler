import { callFunction } from './api'

/** 读工作室欢迎语（主页显示，所有登录者一致） */
export function getGreeting(): Promise<{ greeting: string }> {
  return callFunction('config', { action: 'get' }, { silent: true })
}

/** 改工作室欢迎语（仅 owner） */
export function setGreeting(greeting: string): Promise<{ greeting: string }> {
  return callFunction('config', { action: 'setGreeting', data: { greeting } })
}
