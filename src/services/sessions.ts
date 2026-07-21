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
