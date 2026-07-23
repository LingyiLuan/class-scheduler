import { callFunction, CallOptions } from './api'
import { SessionStatus } from '../constants'

export interface Student {
  _id: string
  name: string
  phone?: string
  levelTag?: string
  note?: string
  inviteCode?: string
  userId?: string | null
  createdAt?: string
  isDeleted?: boolean
  deactivatedAt?: string
}

export interface StudentInput {
  name: string
  phone?: string
  levelTag?: string
  note?: string
}

export interface SessionBrief {
  _id: string
  courseType: string
  courseTypeName?: string | null
  startTime: string
  durationMin: number
  status: SessionStatus
  mine?: boolean
  teacherName?: string
}

/** 学员列表。filter='active'(默认)在读 / 'inactive' 已停用；inactiveCount 供前端决定 tab 显隐 */
export function listStudents(
  filter?: 'active' | 'inactive'
): Promise<{ list: Student[]; inactiveCount?: number }> {
  return callFunction('students', { action: 'list', data: filter ? { filter } : {} })
}

export function getStudent(id: string): Promise<Student> {
  return callFunction('students', { action: 'get', data: { id } })
}

export function createStudent(data: StudentInput): Promise<Student> {
  return callFunction('students', { action: 'create', data })
}

export function updateStudent(id: string, data: Partial<StudentInput>): Promise<Student> {
  return callFunction('students', { action: 'update', data: { id, ...data } })
}

/** 删除：无引用则硬删；有课程引用云端返回 40002，调用方提示改为停用 */
export function deleteStudent(id: string): Promise<{ _id: string }> {
  return callFunction('students', { action: 'delete', data: { id } }, { silent: true })
}

/** 停用（软删，从列表隐藏，历史保留）。删除被引用学员时的降级操作 */
export function deactivateStudent(id: string): Promise<{ _id: string }> {
  return callFunction('students', { action: 'deactivate', data: { id } })
}

/** 恢复：停用学员回到在读 */
export function reactivateStudent(id: string): Promise<{ _id: string }> {
  return callFunction('students', { action: 'reactivate', data: { id } })
}

export function getBalance(
  studentId: string,
  options?: CallOptions
): Promise<{ studentId: string; balance: number }> {
  return callFunction('credits', { action: 'getBalance', data: { studentId } }, options)
}

/** 批量余额：一次拿多个学员的余额映射 { studentId: balance }，替代 N 次 getBalance */
export function getBalances(studentIds: string[]): Promise<{ balances: Record<string, number> }> {
  return callFunction('credits', { action: 'balances', data: { studentIds } }, { silent: true })
}

export function listStudentSessions(studentId: string): Promise<{ list: SessionBrief[] }> {
  return callFunction('sessions', { action: 'listByStudent', data: { studentId } })
}
