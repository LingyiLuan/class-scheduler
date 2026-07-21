import Taro from '@tarojs/taro'
import { callFunction } from './api'
import { UserRole, STORAGE_LOGIN } from '../constants'

export interface LoginInfo {
  role: string
  isActive: boolean
  boundStudentIds: string[]
}

interface CacheEnvelope {
  info: LoginInfo
  ts: number
}

// 缓存有效期 30 分钟：过期后 ensureLogin 重新请求，避免云端停用/改权限后本地长期不刷新
const TTL = 30 * 60 * 1000

function readCache(): CacheEnvelope | null {
  try {
    return (Taro.getStorageSync(STORAGE_LOGIN) as CacheEnvelope) || null
  } catch {
    return null
  }
}

export function getCachedLogin(): LoginInfo | null {
  const c = readCache()
  return c ? c.info : null
}

async function fetchLogin(): Promise<LoginInfo> {
  const info = await callFunction<LoginInfo>('login', {}, { silent: true })
  try {
    Taro.setStorageSync(STORAGE_LOGIN, { info, ts: Date.now() } as CacheEnvelope)
  } catch {
    // 存储失败不阻断登录
  }
  return info
}

/** 缓存优先且带 30 分钟过期：未过期直接用缓存，过期或无缓存才向服务端登录 */
export async function ensureLogin(): Promise<LoginInfo> {
  const c = readCache()
  if (c && Date.now() - c.ts < TTL) return c.info
  return fetchLogin()
}

/** 强制向服务端刷新登录态（如「重新检测激活状态」） */
export function refreshLogin(): Promise<LoginInfo> {
  return fetchLogin()
}

export function clearLogin(): void {
  try {
    Taro.removeStorageSync(STORAGE_LOGIN)
  } catch {
    // ignore
  }
}

/** 可进入应用：owner 或 teacher 且已激活（一期多老师使用）。student 与未激活进待激活页 */
export function canAccessApp(info: LoginInfo | null): boolean {
  return (
    !!info &&
    (info.role === UserRole.Owner || info.role === UserRole.Teacher) &&
    info.isActive === true
  )
}
