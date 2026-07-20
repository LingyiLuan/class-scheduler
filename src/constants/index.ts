/**
 * 全局枚举与常量。业务代码不得直接写这些字符串字面量，一律引用此处。
 * 取值与 docs/dev-guide.md、docs/schema.sql 保持一致。
 */

/** 课程状态 */
export enum SessionStatus {
  Scheduled = 'scheduled',
  Completed = 'completed',
  Absent = 'absent',
  Cancelled = 'cancelled'
}

/** 课时流水原因 */
export enum CreditReason {
  Purchase = 'purchase',
  Attend = 'attend',
  Absent = 'absent',
  Manual = 'manual'
}

/** 数据表名，集中管理避免各处硬编码 */
export const Tables = {
  Students: 'students',
  Packages: 'packages',
  ClassSessions: 'class_sessions',
  Recurrences: 'recurrences',
  CreditLogs: 'credit_logs'
} as const
