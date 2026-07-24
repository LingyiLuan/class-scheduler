const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, getContext, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')
const { WORKSPACE_DEFAULT, SCHEMA_VERSION } = require('./_shared/workspace')

const db = cloud.database()
const _ = db.command
const inviteCodes = db.collection('inviteCodes')
const guardianLinks = db.collection('guardianLinks')
const students = db.collection('students')
const usersCol = db.collection('users')

// 输邀请码绑定。使用者 = 学生本人或其家长（guardianLinks/guardianOpenid 是内部命名，不代表一定是家长）。
// 调用者可能还是"未激活"状态，不能走 requireRole，改 getContext。
// 成功即把自己设为 student 并激活（自助，无需 owner）；已绑则幂等不重复。
async function bindByCode(event = {}) {
  const ctx = await getContext()
  if (!ctx.user) return fail(40101, '请先登录')
  const code = String((event.data && event.data.code) || '').trim().toUpperCase()
  if (!code) return fail(40001, '请输入邀请码')

  const rows = (await inviteCodes.where({ code }).limit(10).get()).data
  if (!rows.length) return fail(40400, '邀请码不正确，请向老师确认')
  const active = rows.find((r) => r.disabled !== true)
  if (!active) return fail(40400, '该邀请码已失效，请向老师索取新的')
  const s = (await students.where({ _id: active.studentId }).get()).data[0]
  if (!s || s.isDeleted === true) return fail(40400, '该学员信息不可用，请联系老师')

  // 幂等绑定
  const exist = (
    await guardianLinks
      .where({ studentId: active.studentId, guardianOpenid: ctx.openid })
      .limit(1)
      .get()
  ).data[0]
  const already = !!exist
  if (!already) {
    await guardianLinks.add({
      data: {
        studentId: active.studentId,
        guardianOpenid: ctx.openid,
        relation: (event.data && event.data.relation) || '',
        workspaceId: WORKSPACE_DEFAULT,
        schemaVersion: SCHEMA_VERSION,
        createdAt: db.serverDate()
      }
    })
  }
  // 已是激活的 owner/teacher 不降级（双身份留给"切换身份"）；其余设为家长并激活
  const isStaff = ctx.user.isActive === true && (ctx.user.role === 'owner' || ctx.user.role === 'teacher')
  if (!isStaff) {
    await usersCol.doc(ctx.user._id).update({ data: { role: 'student', isActive: true } })
  }
  return ok({ studentId: active.studentId, studentName: s.name, already })
}

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
  // 家长绑定：调用者未激活，单独走 getContext
  if (event.action === 'bindByCode') {
    try {
      return await bindByCode(event)
    } catch (e) {
      if (e instanceof AuthError) return fail(e.code, e.message)
      return fail(50000, (e && e.message) || '绑定失败')
    }
  }

  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 老师端：某学员的当前有效码 + 已绑定家长
      case 'getForStudent': {
        if (!data.studentId) return fail(40001, '缺少学员 id')
        const code = await activeCode(data.studentId)
        // 不用 orderBy('createdAt')：云 DB 会把缺该字段的记录排除。改 JS 排序，缺字段也能显示。
        const g = await guardianLinks.where({ studentId: data.studentId }).limit(100).get()
        const sorted = g.data.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )
        return ok({
          code: code ? code.code : null,
          guardians: sorted.map((x) => ({
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
