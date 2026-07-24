import { callFunction } from './api'

export interface Guardian {
  _id: string
  guardianOpenid: string
  relation: string
  createdAt?: string
}

/** 某学员的有效邀请码 + 已绑定账号（学生本人或家长） */
export function getInvite(studentId: string): Promise<{ code: string | null; guardians: Guardian[] }> {
  return callFunction('invites', { action: 'getForStudent', data: { studentId } }, { silent: true })
}

/** 生成 / 重生邀请码（作废旧码，返回新码） */
export function generateInvite(studentId: string): Promise<{ code: string }> {
  return callFunction('invites', { action: 'generate', data: { studentId } })
}

/** 作废当前邀请码 */
export function disableInvite(studentId: string): Promise<{ studentId: string }> {
  return callFunction('invites', { action: 'disable', data: { studentId } })
}

/** 解绑账号 */
export function unbindGuardian(linkId: string): Promise<{ _id: string }> {
  return callFunction('invites', { action: 'unbindGuardian', data: { linkId } })
}

/** 输邀请码绑定（使用者=学生本人或家长，成功后成为 student 并激活）。失败信息由 err.message 承载 */
export function bindByCode(
  code: string
): Promise<{ studentId: string; studentName: string; already: boolean }> {
  return callFunction('invites', { action: 'bindByCode', data: { code } }, { silent: true })
}
