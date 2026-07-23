const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
const users = db.collection('users')
const ROLES = ['owner', 'teacher', 'student']

// 成员管理（仅 owner）：列出所有用户、激活/停用、设角色。
async function loadUser(id) {
  if (!id) throw new AuthError(40001, '缺少用户 id')
  const r = await users.where({ _id: id }).get()
  const u = r.data[0]
  if (!u) throw new AuthError(40400, '用户不存在')
  return u
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner']) // 仅管理员
    const { action, data = {} } = event

    switch (action) {
      case 'list': {
        const res = await users.orderBy('createdAt', 'desc').limit(200).get()
        const list = res.data.map((u) => ({
          _id: u._id,
          displayName: u.displayName || '',
          role: u.role,
          isActive: !!u.isActive,
          createdAt: u.createdAt,
          self: u.openid === ctx.openid
        }))
        return ok({ list })
      }

      // 激活/停用。不能停用自己（防把唯一管理员锁在门外）
      case 'setActive': {
        const u = await loadUser(data.id)
        const isActive = data.isActive !== false
        if (u.openid === ctx.openid && !isActive) return fail(40002, '不能停用自己')
        await users.doc(data.id).update({ data: { isActive } })
        return ok({ _id: data.id, isActive })
      }

      // 设角色。不能改自己的管理员角色
      case 'setRole': {
        if (!ROLES.includes(data.role)) return fail(40001, '角色无效')
        const u = await loadUser(data.id)
        if (u.openid === ctx.openid && data.role !== 'owner') {
          return fail(40002, '不能修改自己的管理员角色')
        }
        await users.doc(data.id).update({ data: { role: data.role } })
        return ok({ _id: data.id, role: data.role })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
