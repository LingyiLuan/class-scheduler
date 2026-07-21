const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()

// 校验学员存在且归调用者（owner 全权），返回学员文档
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
      // 新增课包（充值）：写课包 + 写一条 +N 购买流水，两步在事务中原子完成
      case 'create': {
        const { studentId, note = '' } = data
        const totalCredits = Number(data.totalCredits)
        if (!Number.isInteger(totalCredits) || totalCredits <= 0) {
          return fail(40001, '充值次数必须为正整数')
        }
        await assertStudentOwned(studentId, ctx)

        const now = db.serverDate()
        const result = await db.runTransaction(async (transaction) => {
          const pkg = await transaction.collection('packages').add({
            data: {
              ownerId: ctx.openid,
              studentId,
              totalCredits,
              purchasedAt: now,
              note
            }
          })
          await transaction.collection('creditLogs').add({
            data: {
              studentId,
              sessionId: null,
              delta: totalCredits,
              reason: 'purchase',
              createdAt: now
            }
          })
          return { _id: pkg._id }
        })

        return ok({ _id: result._id, studentId, totalCredits })
      }

      // 某学员的课包（充值）记录，按购买时间倒序
      case 'list': {
        await assertStudentOwned(data.studentId, ctx)
        const res = await db
          .collection('packages')
          .where({ studentId: data.studentId })
          .orderBy('purchasedAt', 'desc')
          .limit(100)
          .get()
        return ok({ list: res.data })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
