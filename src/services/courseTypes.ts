import { callFunction } from './api'

export interface CourseType {
  _id: string
  ownerId?: string
  name: string
  durationMin: number
  creditCost: number
  isActive: boolean
  sortOrder: number
  slug?: string | null
}

/** 列出课程类型。activeOnly=true 只返回启用的（建课表单用，停用的完全不出现） */
export function listCourseTypes(activeOnly = false): Promise<{ list: CourseType[] }> {
  return callFunction('courseTypes', { action: 'list', data: { activeOnly } })
}

export function createCourseType(name: string, durationMin: number): Promise<CourseType> {
  return callFunction('courseTypes', { action: 'create', data: { name, durationMin } })
}

export function updateCourseType(
  id: string,
  patch: { name?: string; durationMin?: number }
): Promise<{ _id: string }> {
  return callFunction('courseTypes', { action: 'update', data: { id, ...patch } })
}

export function setCourseTypeActive(id: string, isActive: boolean): Promise<{ _id: string }> {
  return callFunction('courseTypes', { action: 'setActive', data: { id, isActive } })
}

/** 硬删：仅当从未被课程引用；否则云端返回 40002，调用方提示改为停用 */
export function removeCourseType(id: string): Promise<{ _id: string }> {
  return callFunction('courseTypes', { action: 'remove', data: { id } }, { silent: true })
}

export function reorderCourseTypes(ids: string[]): Promise<{ reordered: number }> {
  return callFunction('courseTypes', { action: 'reorder', data: { ids } })
}

/** 一次性迁移历史数据（种默认类型 + 回填 courseTypeId 快照） */
export function migrateCourseTypes(): Promise<{
  migratedSessions: number
  migratedRecurrences: number
  types: number
}> {
  return callFunction('courseTypes', { action: 'migrate' }, { loading: '迁移中' })
}
