import { callFunction } from './api'

export interface PackageInput {
  studentId: string
  totalCredits: number
  note?: string
}

/** 新增课包（充值）：云函数内事务写课包 + +N 购买流水 */
export function createPackage(
  data: PackageInput
): Promise<{ _id: string; studentId: string; totalCredits: number }> {
  return callFunction('packages', { action: 'create', data })
}
