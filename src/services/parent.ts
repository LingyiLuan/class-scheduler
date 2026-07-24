import { callFunction } from './api'

export interface Child {
  _id: string
  name: string
  aliasCn: string
  levelTag: string
  balance: number
}

export interface ChildSession {
  _id: string
  courseType: string
  courseTypeName?: string | null
  startTime: string
  durationMin: number
  status: string
}

/** 我的学生 + 各自余额 */
export function getChildren(): Promise<{ list: Child[] }> {
  return callFunction('parent', { action: 'children' })
}

/** 某个学生的余额 + 上课记录（只读） */
export function getChildSessions(
  studentId: string
): Promise<{ name: string; balance: number; list: ChildSession[] }> {
  return callFunction('parent', { action: 'childSessions', data: { studentId } })
}
