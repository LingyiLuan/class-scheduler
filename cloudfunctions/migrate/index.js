/**
 * 数据迁移（二期第 1 步）：给 7 张表缺 workspaceId 的记录回填 workspaceId + schemaVersion。
 * 只增字段、不改不删、幂等、可重复运行（每次只补还缺的）。查询不使用该字段，回填出错零影响业务。
 *
 * 动作：
 *  - 默认（回填）：需 { confirm:'YES_MIGRATE' }，可选 { only:'creditLogs' } 只迁一张表。
 *  - 校验：{ action:'verify' }（只读，返回每张表还缺字段的记录数，应全为 0）。
 *
 * 云端测试：{ "confirm":"YES_MIGRATE" }  或  { "action":"verify" }
 *
 * 回滚 R1：执行前手动导出这 7 个集合；出错重跑本函数，或部署旧版写入函数（不再注入字段，多余字段惰性无害）。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { WORKSPACE_DEFAULT, SCHEMA_VERSION } = require('./_shared/workspace')

const db = cloud.database()
const _ = db.command

const TARGETS = [
  'students',
  'classSessions',
  'recurrences',
  'packages',
  'creditLogs',
  'courseTypes',
  'notifications'
]
const CONFIRM = 'YES_MIGRATE'

// 回填一张表：循环 update 直到没有缺字段的记录（单次 update 有条数上限）
async function backfill(name) {
  const col = db.collection(name)
  let updated = 0
  for (let i = 0; i < 10000; i++) {
    const r = await col
      .where({ workspaceId: _.exists(false) })
      .update({ data: { workspaceId: WORKSPACE_DEFAULT, schemaVersion: SCHEMA_VERSION } })
    const n = (r.stats && r.stats.updated) || 0
    updated += n
    if (n === 0) break
  }
  return updated
}

async function verify(name) {
  const r = await db.collection(name).where({ workspaceId: _.exists(false) }).count()
  return r.total
}

// R3 安全改名：给 notifications 缺 recipientOpenid 的记录回填 recipientOpenid = ownerId（复制，不删 ownerId）。
// 逐条 update（不能在批量 update 里引用另一字段的值），循环到无缺。
async function backfillRecipient() {
  const col = db.collection('notifications')
  let updated = 0
  for (let i = 0; i < 10000; i++) {
    const r = await col.where({ recipientOpenid: _.exists(false) }).limit(100).get()
    if (!r.data.length) break
    for (const d of r.data) {
      await col.doc(d._id).update({ data: { recipientOpenid: d.ownerId || null } })
      updated++
    }
  }
  return updated
}

exports.main = async (event = {}) => {
  try {
    // 校验：只读
    if (event.action === 'verify') {
      const missing = {}
      for (const name of TARGETS) missing[name] = await verify(name)
      const allDone = Object.values(missing).every((n) => n === 0)
      return { code: 0, data: { missing, allDone } }
    }

    // R3 校验：notifications 还有多少缺 recipientOpenid（应为 0）
    if (event.action === 'verifyRecipient') {
      const r = await db.collection('notifications').where({ recipientOpenid: _.exists(false) }).count()
      return { code: 0, data: { notificationsMissingRecipient: r.total, allDone: r.total === 0 } }
    }

    // R3 回填：recipientOpenid = ownerId（需确认）
    if (event.action === 'backfillRecipient') {
      if (event.confirm !== CONFIRM) {
        return { code: 40001, msg: `未确认：回填需传 confirm:'${CONFIRM}'（或 action:'verifyRecipient' 只读校验）` }
      }
      const updated = await backfillRecipient()
      console.log('[migrate.recipient]', updated)
      return { code: 0, data: { backfilledRecipient: updated } }
    }

    // 回填：需确认
    if (event.confirm !== CONFIRM) {
      return { code: 40001, msg: `未确认：回填需传 confirm:'${CONFIRM}'（或 action:'verify' 只读校验）` }
    }
    const list = event.only ? [event.only] : TARGETS
    const updated = {}
    for (const name of list) {
      try {
        updated[name] = await backfill(name)
      } catch (e) {
        updated[name] = `失败: ${(e && e.message) || e}`
      }
    }
    console.log('[migrate.workspace]', JSON.stringify(updated))
    return { code: 0, data: { updated } }
  } catch (e) {
    return { code: 50000, msg: (e && e.message) || '迁移失败' }
  }
}
