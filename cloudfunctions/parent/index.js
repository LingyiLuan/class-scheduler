const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate
const guardianLinks = db.collection('guardianLinks')
const students = db.collection('students')
const sessions = db.collection('classSessions')

// 学生端只读（使用者可能是学生本人或其家长；字段沿用 guardian* 内部命名，不代表一定是家长）。
// 只能看自己绑定的学生。
async function boundStudentIds(openid) {
  const g = await guardianLinks.where({ guardianOpenid: openid }).limit(100).get()
  return [...new Set(g.data.map((x) => x.studentId).filter(Boolean))]
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['student'])
    const { action, data = {} } = event

    switch (action) {
      // 我的孩子 + 各自余额（家长首页）
      case 'children': {
        const ids = await boundStudentIds(ctx.openid)
        if (!ids.length) return ok({ list: [] })
        const sres = await students.where({ _id: _.in(ids), isDeleted: _.neq(true) }).get()
        const bal = {}
        ids.forEach((id) => (bal[id] = 0))
        const agg = await db
          .collection('creditLogs')
          .aggregate()
          .match({ studentId: _.in(ids) })
          .group({ _id: '$studentId', total: $.sum('$delta') })
          .limit(ids.length)
          .end()
        agg.list.forEach((r) => (bal[r._id] = r.total))
        const list = sres.data.map((s) => ({
          _id: s._id,
          name: s.name,
          aliasCn: s.aliasCn || '',
          levelTag: s.levelTag || '',
          balance: bal[s._id] != null ? bal[s._id] : 0
        }))
        return ok({ list })
      }

      // 某个孩子的上课记录（课表+历史），只读；校验该孩子确实绑定在本家长名下
      case 'childSessions': {
        const ids = await boundStudentIds(ctx.openid)
        if (!data.studentId || ids.indexOf(data.studentId) === -1) {
          return fail(40301, '无权查看该学员')
        }
        const s = (await students.where({ _id: data.studentId }).get()).data[0]
        if (!s || s.isDeleted === true) return fail(40400, '学员不存在')
        const balAgg = await db
          .collection('creditLogs')
          .aggregate()
          .match({ studentId: data.studentId })
          .group({ _id: null, total: $.sum('$delta') })
          .end()
        const balance = balAgg.list && balAgg.list[0] ? balAgg.list[0].total : 0
        const res = await sessions
          .where({ studentIds: data.studentId })
          .orderBy('startTime', 'desc')
          .limit(100)
          .get()
        const list = res.data.map((x) => ({
          _id: x._id,
          courseType: x.courseType,
          courseTypeName: x.courseTypeName,
          startTime: x.startTime,
          durationMin: x.durationMin,
          status: x.status
        }))
        return ok({ name: s.name, balance, list })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
