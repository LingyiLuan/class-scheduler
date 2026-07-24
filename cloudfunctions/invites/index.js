const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')
const { WORKSPACE_DEFAULT, SCHEMA_VERSION } = require('./_shared/workspace')

const db = cloud.database()
const _ = db.command
const inviteCodes = db.collection('inviteCodes')
const guardianLinks = db.collection('guardianLinks')
const students = db.collection('students')

// 去掉易混淆的 0/O、1/I/L
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function randomCode(len = 6) {
  let s = ''
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)]
  return s
}
// 全局唯一（跨所有码，含已作废），保证家长输码能唯一解析到学员
async function genUniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = randomCode(6)
    const { total } = await inviteCodes.where({ code }).count()
    if (total === 0) return code
  }
  throw new AuthError(50001, '邀请码生成失败，请重试')
}
async function activeCode(studentId) {
  const r = await inviteCodes
    .where({ studentId, disabled: _.neq(true) })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  return r.data[0] || null
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 老师端：某学员的当前有效码 + 已绑定家长
      case 'getForStudent': {
        if (!data.studentId) return fail(40001, '缺少学员 id')
        const code = await activeCode(data.studentId)
        const g = await guardianLinks
          .where({ studentId: data.studentId })
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get()
        return ok({
          code: code ? code.code : null,
          guardians: g.data.map((x) => ({
            _id: x._id,
            guardianOpenid: x.guardianOpenid,
            relation: x.relation || '',
            createdAt: x.createdAt
          }))
        })
      }

      // 生成 / 重生：作废该生旧的有效码，建一枚新码
      case 'generate': {
        if (!data.studentId) return fail(40001, '缺少学员 id')
        const s = (await students.where({ _id: data.studentId }).get()).data[0]
        if (!s || s.isDeleted === true) return fail(40400, '学员不存在')
        await inviteCodes
          .where({ studentId: data.studentId, disabled: _.neq(true) })
          .update({ data: { disabled: true } })
        const code = await genUniqueCode()
        await inviteCodes.add({
          data: {
            code,
            studentId: data.studentId,
            workspaceId: WORKSPACE_DEFAULT,
            schemaVersion: SCHEMA_VERSION,
            createdBy: ctx.openid,
            disabled: false,
            createdAt: db.serverDate()
          }
        })
        return ok({ code })
      }

      // 作废：停用当前有效码，不新建（该生暂无可用码，已绑定家长不受影响）
      case 'disable': {
        if (!data.studentId) return fail(40001, '缺少学员 id')
        await inviteCodes
          .where({ studentId: data.studentId, disabled: _.neq(true) })
          .update({ data: { disabled: true } })
        return ok({ studentId: data.studentId })
      }

      // 解绑家长
      case 'unbindGuardian': {
        if (!data.linkId) return fail(40001, '缺少绑定 id')
        await guardianLinks.doc(data.linkId).remove()
        return ok({ _id: data.linkId })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
