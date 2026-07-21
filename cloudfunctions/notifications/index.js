const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
const _ = db.command
const col = db.collection('notifications')

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 本人消息流，按时间倒序分页
      case 'list': {
        const page = Math.max(1, Number(data.page) || 1)
        const size = Math.min(50, Math.max(1, Number(data.pageSize) || 20))
        const res = await col
          .where({ ownerId: ctx.openid })
          .orderBy('createdAt', 'desc')
          .skip((page - 1) * size)
          .limit(size)
          .get()
        return ok({ list: res.data, page, pageSize: size })
      }

      // 未读数（首页铃铛红点用）
      case 'unreadCount': {
        const r = await col.where({ ownerId: ctx.openid, readAt: _.eq(null) }).count()
        return ok({ count: r.total })
      }

      // 标记已读：传 id 标单条，否则全部已读
      case 'markRead': {
        const now = db.serverDate()
        if (data.id) {
          await col.where({ _id: data.id, ownerId: ctx.openid }).update({ data: { readAt: now } })
        } else {
          await col
            .where({ ownerId: ctx.openid, readAt: _.eq(null) })
            .update({ data: { readAt: now } })
        }
        return ok({})
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
