import { callFunction } from './api'

export interface NotiRow {
  _id: string
  type: string
  title: string
  body: string
  refType?: string | null
  refId?: string | null
  readAt?: string | null
  createdAt: string
}

export function listNotifications(page = 1): Promise<{ list: NotiRow[]; page: number; pageSize: number }> {
  return callFunction('notifications', { action: 'list', data: { page } })
}

/** 未读数（首页铃铛红点，静默） */
export function unreadCount(): Promise<{ count: number }> {
  return callFunction('notifications', { action: 'unreadCount' }, { silent: true })
}

/** 标记已读：传 id 标单条，否则全部已读 */
export function markRead(id?: string): Promise<void> {
  return callFunction('notifications', { action: 'markRead', data: id ? { id } : {} }, { silent: true })
}
