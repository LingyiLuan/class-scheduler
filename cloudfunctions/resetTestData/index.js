/**
 * ⚠️⚠️ 临时函数——清空测试数据用。验收/上线前用完请立即删除本云函数（resetTestData）。⚠️⚠️
 *
 * 作用：清空以下集合的【全部记录】（不删集合本身、不动索引）：
 *   students, classSessions, recurrences, packages, creditLogs, notifications, notifyLogs, inviteCodes, guardianLinks
 * 不动：users、courseTypes。
 *
 * 安全阀：必须传 { confirm: 'YES_DELETE_ALL' } 才执行，否则直接返回、不删任何东西。
 * 云开发单次 remove 有条数上限，函数内循环删到空。
 *
 * 调用：云开发控制台 → 云函数 → resetTestData → 云端测试，请求参数填：
 *   { "confirm": "YES_DELETE_ALL" }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 要清空的集合（不含 users、courseTypes）
const TARGETS = [
  'students',
  'classSessions',
  'recurrences',
  'packages',
  'creditLogs',
  'notifications',
  'notifyLogs',
  'inviteCodes',
  'guardianLinks'
]
const CONFIRM = 'YES_DELETE_ALL'

// 循环删到空：每轮 where(全部).remove() 删一批，直到删除数为 0
async function clearCollection(name) {
  const col = db.collection(name)
  let removed = 0
  for (let i = 0; i < 10000; i++) {
    const del = await col.where({ _id: _.exists(true) }).remove()
    const n = (del.stats && del.stats.removed) || 0
    removed += n
    if (n === 0) break
  }
  return removed
}

exports.main = async (event = {}) => {
  if (event.confirm !== CONFIRM) {
    return { code: 40001, msg: `未确认：必须传 confirm: '${CONFIRM}' 才执行，当前未清除任何数据` }
  }
  const cleared = {}
  for (const name of TARGETS) {
    try {
      cleared[name] = await clearCollection(name)
    } catch (e) {
      cleared[name] = `失败: ${(e && e.message) || e}`
    }
  }
  console.log('[resetTestData] 清空结果', JSON.stringify(cleared))
  return { code: 0, data: { cleared } }
}
