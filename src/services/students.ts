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
}

export function listStudents(): Promise<{ list: Student[] }> {
  return callFunction('students', { action: 'list' })
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

export function deleteStudent(id: string): Promise<{ _id: string }> {
  return callFunction('students', { action: 'delete', data: { id } })
}

export function getBalance(
  studentId: string,
  options?: CallOptions
): Promise<{ studentId: string; balance: number }> {
  return callFunction('credits', { action: 'getBalance', data: { studentId } }, options)
}

export function listStudentSessions(studentId: string): Promise<{ list: SessionBrief[] }> {
  return callFunction('sessions', { action: 'listByStudent', data: { studentId } })
}
