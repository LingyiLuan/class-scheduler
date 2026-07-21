import { callFunction } from './api'

export interface CreateRecurrenceInput {
  courseTypeId?: string
  courseType?: string
  weekdays: number[]
  timeOfDay: string
  durationMin: number
  studentIds: string[]
  startDate: string
  endDate: string
  /** auto：有冲突返回 40901+conflicts；skip：只建不冲突的；force：全部建 */
  mode?: 'auto' | 'skip' | 'force'
}

/**
 * 创建循环课并批量生成。冲突且 mode='auto' 时云函数返回 40901，
 * callFunction 抛 ApiError 并携带 data.conflicts，调用方据此让老师选跳过/强建。
 */
export function createRecurrence(
  data: CreateRecurrenceInput
): Promise<{ _id: string; generated: number; skipped: number }> {
  return callFunction('recurrences', { action: 'create', data }, { silent: true })
}
