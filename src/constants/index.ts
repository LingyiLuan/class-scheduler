/**
 * 全局枚举与常量。业务代码不得直接写这些字符串字面量，一律引用此处。
 * 取值与 docs/dev-guide.md、docs/schema.md 保持一致。
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
  /** 撤销完成时的反向入账（与老师手工 manual 区分，便于对账） */
  Revert = 'revert',
  Manual = 'manual'
}

/** 用户角色 */
export enum UserRole {
  Owner = 'owner',
  Teacher = 'teacher',
  Student = 'student'
}

/** 课程类型 */
export enum CourseType {
  Makeup = 'makeup',
  Cambridge = 'cambridge'
}

/** 各课程类型的默认时长（分钟），建课时带出、允许手改 */
export const COURSE_TYPE_DEFAULT_DURATION: Record<CourseType, number> = {
  [CourseType.Makeup]: 90,
  [CourseType.Cambridge]: 120
}

/** 本地存储键 */
export const STORAGE_LOGIN = 'loginInfo'

/** 云数据库集合名，集中管理避免各处硬编码 */
export const Collections = {
  Users: 'users',
  Students: 'students',
  Packages: 'packages',
  ClassSessions: 'classSessions',
  Recurrences: 'recurrences',
  CreditLogs: 'creditLogs'
} as const
