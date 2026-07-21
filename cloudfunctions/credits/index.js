const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
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
        const res = await db
          .collection('creditLogs')
          .aggregate()
          .match({ studentId: data.studentId })
          .group({ _id: null, total: $.sum('$delta') })
          .end()
        const balance = res.list && res.list[0] ? res.list[0].total : 0
        return ok({ studentId: data.studentId, balance })
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
