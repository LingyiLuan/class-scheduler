import Taro from '@tarojs/taro'
import { callFunction } from './api'
import { UserRole } from '../constants'

export interface LoginInfo {
  role: string
  isActive: boolean
  boundStudentIds: string[]
}

const STORAGE_KEY = 'loginInfo'

export function getCachedLogin(): LoginInfo | null {
  try {
    return (Taro.getStorageSync(STORAGE_KEY) as LoginInfo) || null
  } catch {
    return null
  }
}

async function fetchLogin(): Promise<LoginInfo> {
  const info = await callFunction<LoginInfo>('login', {}, { silent: true })
  try {
    Taro.setStorageSync(STORAGE_KEY, info)
  } catch {
    // 存储失败不阻断登录
  }
  return info
}

/** 缓存优先：有缓存直接用，避免每次启动都请求；无缓存才向服务端登录 */
export async function ensureLogin(): Promise<LoginInfo> {
  const cached = getCachedLogin()
  if (cached) return cached
  return fetchLogin()
}

/** 强制向服务端刷新登录态（如「重新检测激活状态」） */
export function refreshLogin(): Promise<LoginInfo> {
  return fetchLogin()
}

export function clearLogin(): void {
  try {
    Taro.removeStorageSync(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function isOwnerActive(info: LoginInfo | null): boolean {
  return !!info && info.role === UserRole.Owner && info.isActive === true
}
