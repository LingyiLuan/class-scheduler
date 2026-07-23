import { callFunction } from './api'

export interface AdminUser {
  _id: string
  displayName: string
  role: string
  isActive: boolean
  createdAt?: string
  self?: boolean
}

/** 成员列表（仅 owner） */
export function listUsers(): Promise<{ list: AdminUser[] }> {
  return callFunction('usersAdmin', { action: 'list' })
}

/** 激活/停用成员 */
export function setUserActive(id: string, isActive: boolean): Promise<{ _id: string }> {
  return callFunction('usersAdmin', { action: 'setActive', data: { id, isActive } }, { silent: true })
}

/** 设角色（owner/teacher/student） */
export function setUserRole(id: string, role: string): Promise<{ _id: string }> {
  return callFunction('usersAdmin', { action: 'setRole', data: { id, role } }, { silent: true })
}
