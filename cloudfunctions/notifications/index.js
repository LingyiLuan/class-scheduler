const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
const _ = db.command
const col = db.collection('notifications')

const RETAIN_DAYS = 90 // 超过则删
const MAX_PER_OWNER = 300 // 每人超出则删最老的
// R3 安全改名：读取一律按 recipientOpenid（迁移已回填、新写入同时写入）；ownerId 为旧死副本，下一轮才删

// 清理：两个条件取先满足的——超 90 天的删，或每人超 300 条的删最老的。由每日定时触发器调用。
async function cleanup() {
  const cutoff = new Date(Date.now() - RETAIN_DAYS * 86400000)

  // 1) 全局删超 90 天
  let removedOld = 0
  try {
    const r = await col.where({ createdAt: _.lt(cutoff) }).remove()
    removedOld = (r.stats && r.stats.removed) || 0
  } catch (e) {
    console.error('[cleanup] 删旧失败', e && e.message)
  }

  // 2) 每人超 300 条：以第 300 新的那条时间为界，早于它的删
  let removedExcess = 0
  try {
    const owners = await col.aggregate().group({ _id: '$recipientOpenid' }).limit(1000).end()
    for (const o of owners.list) {
      const recipientOpenid = o._id
      if (!recipientOpenid) continue
      const { total } = await col.where({ recipientOpenid }).count()
      if (total <= MAX_PER_OWNER) continue
      const boundary = await col
        .where({ recipientOpenid })
        .orderBy('createdAt', 'desc')
        .skip(MAX_PER_OWNER - 1)
        .limit(1)
        .get()
      if (!boundary.data.length) continue
      const r = await col
        .where({ recipientOpenid, createdAt: _.lt(boundary.data[0].createdAt) })
        .remove()
      removedExcess += (r.stats && r.stats.removed) || 0
    }
  } catch (e) {
    console.error('[cleanup] 删超额失败', e && e.message)
  }

  console.log(`[notifications.cleanup] 删旧 ${removedOld}，删超额 ${removedExcess}`)
  return ok({ removedOld, removedExcess })
}

exports.main = async (event = {}) => {
  const { action, data = {} } = event

  // 定时触发器无 action → 走清理，不鉴权
  if (!action) return cleanup()

  try {
    const ctx = await requireRole(['owner', 'teacher'])

    switch (action) {
      // 本人消息流，按时间倒序分页
      case 'list': {
        const page = Math.max(1, Number(data.page) || 1)
        const size = Math.min(50, Math.max(1, Number(data.pageSize) || 20))
        const res = await col
          .where({ recipientOpenid: ctx.openid })
          .orderBy('createdAt', 'desc')
          .skip((page - 1) * size)
          .limit(size)
          .get()
        return ok({ list: res.data, page, pageSize: size })
      }

      // 未读数（首页铃铛红点用）
      case 'unreadCount': {
        const r = await col.where({ recipientOpenid: ctx.openid, readAt: _.eq(null) }).count()
        return ok({ count: r.total })
      }

      // 近 24h 是否有 43101（额度耗尽/未授权）发送失败 → 消息中心提示补额
      case 'quotaLow': {
        const since = new Date(Date.now() - 24 * 3600000)
        const r = await db
          .collection('notifyLogs')
          .where({ touser: ctx.openid, ok: false, errCode: 43101, createdAt: _.gt(since) })
          .limit(1)
          .get()
        return ok({ quotaLow: r.data.length > 0 })
      }

      // 标记已读：传 id 标单条，否则全部已读
      case 'markRead': {
        const now = db.serverDate()
        if (data.id) {
          await col.where({ _id: data.id, recipientOpenid: ctx.openid }).update({ data: { readAt: now } })
        } else {
          await col
            .where({ recipientOpenid: ctx.openid, readAt: _.eq(null) })
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
