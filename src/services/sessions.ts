import { callFunction } from './api'

export interface SessionRow {
  _id: string
  ownerId?: string
  courseType: string
  startTime: string
  durationMin: number
  status: string
  recurrenceId?: string | null
  studentIds: string[]
  attendance?: Record<string, string>
  note?: string
}

/** 按时间区间列出课程（周视图）。from/to 传 ISO 字符串，云端 new Date 解析 */
export function listSessions(from: string, to: string): Promise<{ list: SessionRow[] }> {
  return callFunction('sessions', { action: 'list', data: { from, to } })
}

export interface CreateSessionInput {
  courseType: string
  startTime: string
  durationMin: number
  studentIds: string[]
  recurrenceId?: string | null
  force?: boolean
}

/**
 * 新建课程。冲突且未强建时云函数返回 code 40901，callFunction 抛 ApiError
 * 并携带 data.conflicts（冲突课程数组），调用方据此弹窗二次确认。
 */
export function createSession(data: CreateSessionInput): Promise<SessionRow> {
  return callFunction('sessions', { action: 'create', data }, { silent: true })
}
