const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
const _ = db.command
const recurrences = db.collection('recurrences')
const sessions = db.collection('classSessions')
const students = db.collection('students')

const COURSE_DEFAULT_DURATION = { makeup: 90, cambridge: 120 }
const MAX_WEEKS = 26
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

async function assertStudentsOwned(studentIds, ctx) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new AuthError(40001, '至少选择一名学员')
  }
  const res = await students.where({ _id: _.in(studentIds) }).get()
  const found = res.data.filter((s) => s.isDeleted !== true)
  if (found.length !== studentIds.length) throw new AuthError(40400, '存在无效或已删除的学员')
  if (ctx.user.role !== 'owner') {
    for (const s of found) {
      if (s.ownerId !== ctx.openid) throw new AuthError(40301, '无权为该学员排课')
    }
  }
}

async function loadOwnedRec(id, ctx) {
  if (!id) throw new AuthError(40001, '缺少循环规则 id')
  const res = await recurrences.where({ _id: id }).get()
  const doc = res.data[0]
  if (!doc || doc.deleted === true) throw new AuthError(40400, '循环规则不存在')
  if (ctx.user.role !== 'owner' && doc.ownerId !== ctx.openid) {
    throw new AuthError(40301, '无权操作该循环规则')
  }
  return doc
}

// 生成 [startDate, endDate] 间每个匹配 weekday 的上课时间；上限 26 周。
// 用 UTC 纯日期算星期，再以 +08:00 拼出真实上课时刻，避免云函数 UTC 运行环境的时区偏移。
function generateStartTimes(startDate, endDate, weekday, timeOfDay) {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const startTs = Date.UTC(sy, sm - 1, sd)
  let endTs = Date.UTC(ey, em - 1, ed)
  const capTs = startTs + MAX_WEEKS * 7 * 86400000
  if (endTs > capTs) endTs = capTs

  const out = []
  for (let ts = startTs; ts <= endTs; ts += 86400000) {
    const dt = new Date(ts)
    if (dt.getUTCDay() === weekday) {
      const ymd = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
        dt.getUTCDate()
      ).padStart(2, '0')}`
      out.push(new Date(`${ymd}T${timeOfDay}:00+08:00`))
    }
    if (out.length > 200) break // 安全上限
  }
  return out
}

async function addSessions(startTimes, rule, ctx) {
  for (const st of startTimes) {
    await sessions.add({
      data: {
        ownerId: ctx.openid,
        courseType: rule.courseType,
        startTime: st,
        durationMin: rule.durationMin,
        status: 'scheduled',
        recurrenceId: rule._id,
        studentIds: rule.studentIds,
        attendance: {},
        note: '',
        createdAt: db.serverDate()
      }
    })
  }
}

// 删除某规则名下「未来且未上课」的实例
async function removeFutureScheduled(recurrenceId) {
  const now = new Date()
  const res = await sessions
    .where({ recurrenceId, status: 'scheduled', startTime: _.gte(now) })
    .get()
  for (const s of res.data) await sessions.doc(s._id).remove()
  return res.data.length
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 创建循环规则并一次性生成实例（≤26 周），endDate 必填
      case 'create': {
        const { courseType, weekday, timeOfDay, studentIds, startDate, endDate } = data
        if (!COURSE_DEFAULT_DURATION[courseType]) return fail(40001, '课程类型无效')
        if (!(Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) return fail(40001, '星期取值无效')
        if (!HHMM.test(timeOfDay || '')) return fail(40001, '时间格式应为 HH:mm')
        if (!startDate || !endDate) return fail(40001, '开始与结束日期必填')
        if (endDate < startDate) return fail(40001, '结束日期不能早于开始日期')
        const durationMin = Number(data.durationMin) || COURSE_DEFAULT_DURATION[courseType]
        if (durationMin <= 0) return fail(40001, '时长无效')
        await assertStudentsOwned(studentIds, ctx)

        const recDoc = {
          ownerId: ctx.openid,
          courseType,
          weekday,
          timeOfDay,
          durationMin,
          studentIds,
          startDate,
          endDate,
          deleted: false,
          createdAt: db.serverDate()
        }
        const rec = await recurrences.add({ data: recDoc })
        const starts = generateStartTimes(startDate, endDate, weekday, timeOfDay)
        await addSessions(starts, { _id: rec._id, ...recDoc }, ctx)
        return ok({ _id: rec._id, generated: starts.length })
      }

      // 列出本人未删除的循环规则
      case 'list': {
        const where = { deleted: _.neq(true) }
        if (ctx.user.role !== 'owner') where.ownerId = ctx.openid
        const res = await recurrences.where(where).orderBy('createdAt', 'desc').limit(100).get()
        return ok({ list: res.data })
      }

      // 修改整个系列：更新规则，仅重建「未来且未上课」的实例，历史一律不动
      case 'updateSeries': {
        const rec = await loadOwnedRec(data.id, ctx)
        const patch = {}
        if (data.courseType !== undefined) {
          if (!COURSE_DEFAULT_DURATION[data.courseType]) return fail(40001, '课程类型无效')
          patch.courseType = data.courseType
        }
        if (data.weekday !== undefined) {
          if (!(Number.isInteger(data.weekday) && data.weekday >= 0 && data.weekday <= 6)) {
            return fail(40001, '星期取值无效')
          }
          patch.weekday = data.weekday
        }
        if (data.timeOfDay !== undefined) {
          if (!HHMM.test(data.timeOfDay)) return fail(40001, '时间格式应为 HH:mm')
          patch.timeOfDay = data.timeOfDay
        }
        if (data.durationMin !== undefined) {
          if (Number(data.durationMin) <= 0) return fail(40001, '时长无效')
          patch.durationMin = Number(data.durationMin)
        }
        if (data.studentIds !== undefined) {
          await assertStudentsOwned(data.studentIds, ctx)
          patch.studentIds = data.studentIds
        }
        if (data.startDate !== undefined) patch.startDate = data.startDate
        if (data.endDate !== undefined) patch.endDate = data.endDate
        const merged = { ...rec, ...patch }
        if (merged.endDate < merged.startDate) return fail(40001, '结束日期不能早于开始日期')

        await recurrences.doc(rec._id).update({ data: patch })

        // 删未来未上课的旧实例，按新规则重建未来实例（>= now）
        await removeFutureScheduled(rec._id)
        const now = Date.now()
        const starts = generateStartTimes(
          merged.startDate,
          merged.endDate,
          merged.weekday,
          merged.timeOfDay
        ).filter((st) => st.getTime() >= now)
        await addSessions(starts, merged, ctx)
        return ok({ _id: rec._id, regenerated: starts.length })
      }

      // 删除系列：软删规则，仅硬删「未来且未上课」的实例，历史保留
      case 'deleteSeries': {
        const rec = await loadOwnedRec(data.id, ctx)
        await recurrences.doc(rec._id).update({ data: { deleted: true } })
        const removed = await removeFutureScheduled(rec._id)
        return ok({ _id: rec._id, removedFuture: removed })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
