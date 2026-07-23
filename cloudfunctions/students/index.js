const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')
const { WS_STAMP, WORKSPACE_DEFAULT } = require('./_shared/workspace')

const db = cloud.database()
const _ = db.command
const students = db.collection('students')

// 邀请码字符集：去掉易混淆的 0/O、1/I/L 等
const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(len = 6) {
  let s = ''
  for (let i = 0; i < len; i++) {
    s += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]
  }
  return s
}

// 生成保证唯一的 6 位邀请码（最多重试 10 次）
async function genUniqueInviteCode() {
  for (let i = 0; i < 10; i++) {
    const code = randomCode(6)
    const { total } = await students.where({ inviteCode: code }).count()
    if (total === 0) return code
  }
  throw new AuthError(50001, '邀请码生成失败，请重试')
}

// 载入学员（二期学员归工作室：任一 owner/teacher 都能操作本工作室学员，不再按 ownerId 限制）
async function loadStudent(id) {
  if (!id) throw new AuthError(40001, '缺少学员 id')
  const res = await students.where({ _id: id }).get()
  const doc = res.data[0]
  // 不拒绝已停用：详情/恢复需要能载入停用学员（列表按 filter 控制可见性）
  if (!doc) throw new AuthError(40400, '学员不存在')
  return doc
}

// 学员是否被任何课程/循环规则引用（用于删除保护）
async function isReferenced(id) {
  const s = await db.collection('classSessions').where({ studentIds: id }).limit(1).get()
  if (s.data.length) return true
  const r = await db.collection('recurrences').where({ studentIds: id, deleted: _.neq(true) }).limit(1).get()
  return r.data.length > 0
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 新建学员：自动生成唯一邀请码，ownerId 记为调用者
      case 'create': {
        const name = (data.name || '').trim()
        if (!name) return fail(40001, '姓名不能为空')
        const inviteCode = await genUniqueInviteCode()
        const doc = {
          ownerId: ctx.openid,
          name,
          phone: data.phone || '',
          levelTag: data.levelTag || '',
          note: data.note || '',
          inviteCode,
          userId: null,
          isDeleted: false,
          createdAt: db.serverDate()
        }
        const res = await students.add({ data: { ...WS_STAMP, ...doc } })
        return ok({ _id: res._id, ...doc })
      }

      // 列表：二期学员归工作室（按 workspaceId）。filter='active'(默认)看在读 / 'inactive' 看已停用。
      // 附带 inactiveCount 供前端决定「已停用」tab 显隐。
      case 'list': {
        const filter = data.filter === 'inactive' ? 'inactive' : 'active'
        const where = { workspaceId: WORKSPACE_DEFAULT }
        where.isDeleted = filter === 'inactive' ? true : _.neq(true)
        const orderField = filter === 'inactive' ? 'deactivatedAt' : 'createdAt'
        const _t = Date.now()
        const res = await students.where(where).orderBy(orderField, 'desc').limit(100).get()
        console.log(`[perf] students.list.query ${Date.now() - _t}ms hit=${res.data.length} filter=${filter}`)
        const inactive = await students.where({ workspaceId: WORKSPACE_DEFAULT, isDeleted: true }).count()
        return ok({ list: res.data, inactiveCount: inactive.total })
      }

      // 详情
      case 'get': {
        const doc = await loadStudent(data.id)
        return ok(doc)
      }

      // 更新：只允许改姓名/手机号/级别标签/备注
      case 'update': {
        await loadStudent(data.id)
        const patch = {}
        for (const k of ['name', 'phone', 'levelTag', 'note']) {
          if (data[k] !== undefined) patch[k] = data[k]
        }
        if (patch.name !== undefined && !String(patch.name).trim()) {
          return fail(40001, '姓名不能为空')
        }
        if (patch.name !== undefined) patch.name = patch.name.trim()
        await students.doc(data.id).update({ data: patch })
        return ok({ _id: data.id, ...patch })
      }

      // 删除：有课程引用只能停用，不能硬删（防止 A 删掉 B 正在教的学员，参照课程类型策略）。
      // 无引用 → 硬删文档；有引用 → 返回 40002，前端提示改为停用。
      case 'delete': {
        await loadStudent(data.id)
        if (await isReferenced(data.id)) {
          return fail(40002, '该学员有课程记录，无法删除，请改为停用', { referenced: true })
        }
        await students.doc(data.id).remove()
        return ok({ _id: data.id, removed: true })
      }

      // 停用：软删（isDeleted=true），记停用时间；保留关联流水/历史课的可追溯。有引用时的删除降级到这里
      case 'deactivate': {
        await loadStudent(data.id)
        await students.doc(data.id).update({ data: { isDeleted: true, deactivatedAt: db.serverDate() } })
        return ok({ _id: data.id, deactivated: true })
      }

      // 恢复：停用学员回到在读
      case 'reactivate': {
        await loadStudent(data.id)
        await students.doc(data.id).update({ data: { isDeleted: false, deactivatedAt: _.remove() } })
        return ok({ _id: data.id, reactivated: true })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
