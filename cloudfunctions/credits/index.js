const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

async function assertStudentOwned(studentId, ctx) {
  if (!studentId) throw new AuthError(40001, '缺少学员 id')
  const res = await db.collection('students').where({ _id: studentId }).get()
  const s = res.data[0]
  if (!s || s.isDeleted === true) throw new AuthError(40400, '学员不存在')
  if (ctx.user.role !== 'owner' && s.ownerId !== ctx.openid) {
    throw new AuthError(40301, '无权操作该学员')
  }
  return s
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 余额：聚合累加该学员所有流水的 delta（唯一真相来源）
      case 'getBalance': {
        await assertStudentOwned(data.studentId, ctx)
        // 加载诊断（第 0 步）：单独计时聚合查询，判断 creditLogs.studentId 索引是否缺失
        const _t = Date.now()
        const res = await db
          .collection('creditLogs')
          .aggregate()
          .match({ studentId: data.studentId })
          .group({ _id: null, total: $.sum('$delta') })
          .end()
        console.log(`[perf] getBalance.aggregate ${Date.now() - _t}ms sid=${data.studentId}`)
        const balance = res.list && res.list[0] ? res.list[0].total : 0
        return ok({ studentId: data.studentId, balance })
      }

      // 批量余额：一次聚合多个学员的余额，返回 { studentId: balance } 映射。替代首页/学员页的 N 次 getBalance。
      case 'balances': {
        const ids = Array.isArray(data.studentIds) ? data.studentIds.filter(Boolean) : []
        if (!ids.length) return ok({ balances: {} })
        // 归属校验一次到位：owner 看全部，teacher 仅自己名下
        const sres = await db.collection('students').where({ _id: _.in(ids) }).get()
        const allowed = sres.data
          .filter((s) => ctx.user.role === 'owner' || s.ownerId === ctx.openid)
          .map((s) => s._id)
        const map = {}
        allowed.forEach((id) => (map[id] = 0)) // 无流水的学员余额为 0
        if (allowed.length) {
          const _t = Date.now()
          const agg = await db
            .collection('creditLogs')
            .aggregate()
            .match({ studentId: _.in(allowed) })
            .group({ _id: '$studentId', total: $.sum('$delta') })
            .end()
          console.log(`[perf] balances.aggregate ${Date.now() - _t}ms n=${allowed.length}`)
          agg.list.forEach((r) => (map[r._id] = r.total))
        }
        return ok({ balances: map })
      }

      // 流水明细，按时间倒序分页
      case 'getLogs': {
        await assertStudentOwned(data.studentId, ctx)
        const page = Math.max(1, Number(data.page) || 1)
        const pageSize = Math.min(100, Math.max(1, Number(data.pageSize) || 20))
        const where = { studentId: data.studentId }

        const { total } = await db.collection('creditLogs').where(where).count()
        const res = await db
          .collection('creditLogs')
          .where(where)
          .orderBy('createdAt', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        return ok({ list: res.data, total, page, pageSize })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
