const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
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

// 载入学员并校验调用者可操作（owner 全权；teacher 仅限自己创建的）
async function loadOwned(id, ctx) {
  if (!id) throw new AuthError(40001, '缺少学员 id')
  const res = await students.where({ _id: id }).get()
  const doc = res.data[0]
  if (!doc) throw new AuthError(40400, '学员不存在')
  if (ctx.user.role !== 'owner' && doc.ownerId !== ctx.openid) {
    throw new AuthError(40301, '无权操作该学员')
  }
  return doc
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
          createdAt: db.serverDate()
        }
        const res = await students.add({ data: doc })
        return ok({ _id: res._id, ...doc })
      }

      // 列表：owner 看全部，teacher 仅看自己的；按创建时间倒序
      case 'list': {
        const where = ctx.user.role === 'owner' ? {} : { ownerId: ctx.openid }
        const res = await students.where(where).orderBy('createdAt', 'desc').limit(100).get()
        return ok({ list: res.data })
      }

      // 详情
      case 'get': {
        const doc = await loadOwned(data.id, ctx)
        return ok(doc)
      }

      // 更新：只允许改姓名/手机号/级别标签/备注
      case 'update': {
        await loadOwned(data.id, ctx)
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

      // 删除学员档案本身（关联的课程/流水不在此级联，历史留存）
      case 'delete': {
        await loadOwned(data.id, ctx)
        await students.doc(data.id).remove()
        return ok({ _id: data.id })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
