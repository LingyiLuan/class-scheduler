import { callFunction } from './api'

export interface SessionRow {
  _id: string
  ownerId?: string
  courseType: string
  courseTypeId?: string | null
  courseTypeName?: string | null
  startTime: string
  durationMin: number
  status: string
  recurrenceId?: string | null
  studentIds: string[]
  attendance?: Record<string, string>
  note?: string
  mine?: boolean
  teacherName?: string
}

/** 按时间区间列出课程。scope='workspace' 看全工作室（课表页，带 mine/teacherName）；默认 'mine'（首页/统计） */
export function listSessions(
  from: string,
  to: string,
  scope?: 'mine' | 'workspace'
): Promise<{ list: SessionRow[] }> {
  return callFunction('sessions', { action: 'list', data: scope ? { from, to, scope } : { from, to } })
}

/** 拉取区间内全部课程（skip 分页循环，用于统计半年数据，超过单次 100 条上限时） */
export async function listSessionsRange(from: string, to: string): Promise<{ list: SessionRow[] }> {
  const all: SessionRow[] = []
  let skip = 0
  for (;;) {
    const res = await callFunction<{ list: SessionRow[] }>('sessions', {
      action: 'list',
      data: { from, to, skip }
    })
    all.push(...res.list)
    if (res.list.length < 100 || skip > 5000) break
    skip += 100
  }
  return { list: all }
}

export interface CreateSessionInput {
  courseTypeId?: string
  courseType?: string
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

export function getSession(id: string): Promise<SessionRow> {
  return callFunction('sessions', { action: 'get', data: { id } })
}

export interface UpdateSessionInput {
  startTime?: string
  durationMin?: number
  note?: string
  force?: boolean
}

/** 编辑单节（改期/时长/备注）。仅 scheduled 可改；冲突时返回 40901(软)/40902(硬)，调用方处理 */
export function updateSession(id: string, data: UpdateSessionInput): Promise<{ _id: string }> {
  return callFunction('sessions', { action: 'update', data: { id, ...data } }, { silent: true })
}

/** 完成：一对一不传 attendance（默认全出席）；小班课传 {studentId: 'present'|'absent'} */
export function completeSession(
  id: string,
  attendance?: Record<string, string>
): Promise<{ _id: string; status: string; attendance: Record<string, string> }> {
  return callFunction('sessions', { action: 'complete', data: { id, attendance } })
}

export function markAbsentSession(id: string): Promise<{ _id: string; status: string }> {
  return callFunction('sessions', { action: 'markAbsent', data: { id } })
}

export function cancelSession(id: string): Promise<{ _id: string; status: string }> {
  return callFunction('sessions', { action: 'cancel', data: { id } })
}

/** 撤销：回到 scheduled；completed 会写反向流水退回课时 */
export function reopenSession(id: string): Promise<{ _id: string; status: string }> {
  return callFunction('sessions', { action: 'reopen', data: { id } })
}
