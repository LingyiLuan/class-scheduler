const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')
const { WS_STAMP } = require('./_shared/workspace')
const { addNotification } = require('./_shared/notify')
const { studentsLabel } = require('./_shared/subscribe')

const db = cloud.database()
const _ = db.command
const recurrences = db.collection('recurrences')
const sessions = db.collection('classSessions')
const students = db.collection('students')
const courseTypesCol = db.collection('courseTypes')

const COURSE_DEFAULT_DURATION = { makeup: 90, cambridge: 120 }
const LEGACY_LABEL = { makeup: '补课', cambridge: '剑桥课程' }

// 解析课程类型：优先 courseTypeId（新），回退 courseType 字符串（旧兼容）
async function resolveCourseType(data, ctx, requireActive) {
  if (data.courseTypeId) {
    const t = (await courseTypesCol.where({ _id: data.courseTypeId }).get()).data[0]
    if (!t || (ctx.user.role !== 'owner' && t.ownerId !== ctx.openid)) {
      throw new AuthError(40400, '课程类型不存在')
    }
    if (requireActive && t.isActive === false) throw new AuthError(40002, '该课程类型已停用')
    return { courseTypeId: t._id, courseTypeName: t.name, legacyType: t.slug || null, defaultDur: t.durationMin }
  }
  const legacy = data.courseType
  if (!COURSE_DEFAULT_DURATION[legacy]) throw new AuthError(40001, '课程类型无效')
  return {
    courseTypeId: null,
    courseTypeName: LEGACY_LABEL[legacy] || legacy,
    legacyType: legacy,
    defaultDur: COURSE_DEFAULT_DURATION[legacy]
  }
}
const MAX_WEEKS = 26
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const ACTIVE_STATUSES = ['scheduled', 'completed', 'absent']

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

// 生成 [startDate, endDate] 间每个匹配 weekdays（可多选）的上课时间；上限 26 周。
// 用 UTC 纯日期算星期，再以 +08:00 拼出真实上课时刻，避免云函数 UTC 运行环境的时区偏移。
function generateStartTimes(startDate, endDate, weekdays, timeOfDay) {
  const wdSet = new Set(weekdays)
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const startTs = Date.UTC(sy, sm - 1, sd)
  let endTs = Date.UTC(ey, em - 1, ed)
  const capTs = startTs + MAX_WEEKS * 7 * 86400000
  if (endTs > capTs) endTs = capTs

  const out = []
  for (let ts = startTs; ts <= endTs; ts += 86400000) {
    const dt = new Date(ts)
    if (wdSet.has(dt.getUTCDay())) {
      const ymd = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
        dt.getUTCDate()
      ).padStart(2, '0')}`
      out.push(new Date(`${ymd}T${timeOfDay}:00+08:00`))
    }
    if (out.length > 400) break // 安全上限
  }
  return out
}

async function addSessions(startTimes, rule, ctx) {
  for (const st of startTimes) {
    await sessions.add({
      data: {
        ...WS_STAMP,
        ownerId: ctx.openid,
        courseType: rule.courseType,
        courseTypeId: rule.courseTypeId || null,
        courseTypeName: rule.courseTypeName || null,
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
      // 创建循环规则并一次性生成实例（≤26 周），endDate 必填，weekdays 可多选。
      // 生成前查冲突：mode='auto' 有冲突则返回 40901+conflicts（不写库）；
      // 'skip' 只建不冲突的；'force' 全部建。
      case 'create': {
        const { timeOfDay, studentIds, startDate, endDate } = data
        const weekdays = Array.isArray(data.weekdays)
          ? data.weekdays
          : Number.isInteger(data.weekday)
            ? [data.weekday]
            : []
        const ct = await resolveCourseType(data, ctx, true)
        if (!weekdays.length || !weekdays.every((w) => Number.isInteger(w) && w >= 0 && w <= 6)) {
          return fail(40001, '请选择星期')
        }
        if (!HHMM.test(timeOfDay || '')) return fail(40001, '时间格式应为 HH:mm')
        if (!startDate || !endDate) return fail(40001, '开始与结束日期必填')
        if (endDate < startDate) return fail(40001, '结束日期不能早于开始日期')
        const durationMin = Number(data.durationMin) || ct.defaultDur
        if (durationMin <= 0) return fail(40001, '时长无效')
        await assertStudentsOwned(studentIds, ctx)

        const starts = generateStartTimes(startDate, endDate, weekdays, timeOfDay)
        if (!starts.length) return fail(40001, '所选范围内没有匹配的上课日')
        const durMs = durationMin * 60000

        // 冲突检测：拉区间内本人「占用时段」的现有课，逐个实例判重叠
        const rangeStart = new Date(starts[0].getTime())
        const rangeEnd = new Date(starts[starts.length - 1].getTime() + durMs)
        const ex = await sessions
          .where({
            ownerId: ctx.openid,
            status: _.in(ACTIVE_STATUSES),
            startTime: _.gte(rangeStart).and(_.lt(rangeEnd))
          })
          .orderBy('startTime', 'asc')
          .limit(1000)
          .get()
        const existing = ex.data.map((s) => {
          const st = new Date(s.startTime).getTime()
          return {
            start: st,
            end: st + (s.durationMin || 0) * 60000,
            courseType: s.courseType,
            studentIds: s.studentIds || []
          }
        })
        const studentSet = new Set(studentIds)
        const conflicts = [] // 软冲突（不同学员）
        const hardConflicts = [] // 硬冲突（同一学员重叠，数据错误）
        const okStarts = []
        for (const st of starts) {
          const s = st.getTime()
          const e = s + durMs
          const hits = existing.filter((x) => x.start < e && s < x.end)
          if (!hits.length) {
            okStarts.push(st)
          } else if (hits.some((h) => h.studentIds.some((sid) => studentSet.has(sid)))) {
            hardConflicts.push({ startTime: st.toISOString() })
          } else {
            conflicts.push({ startTime: st.toISOString(), withCourseType: hits[0].courseType })
          }
        }

        // 硬冲突（同学员重复排课）整批拦截，不允许强建/跳过，需老师调整规则
        if (hardConflicts.length) {
          return fail(40902, `有 ${hardConflicts.length} 节与学员已有课程重复，无法生成`, {
            hard: true,
            conflicts: hardConflicts,
            hardCount: hardConflicts.length
          })
        }

        const mode = data.mode || 'auto'
        if (conflicts.length && mode === 'auto') {
          return fail(40901, '部分课程与已有课程冲突', {
            conflicts,
            total: starts.length,
            conflictCount: conflicts.length
          })
        }
        const toCreate = mode === 'skip' ? okStarts : starts

        const recDoc = {
          ownerId: ctx.openid,
          courseType: ct.legacyType,
          courseTypeId: ct.courseTypeId,
          courseTypeName: ct.courseTypeName,
          weekdays,
          timeOfDay,
          durationMin,
          studentIds,
          startDate,
          endDate,
          deleted: false,
          createdAt: db.serverDate()
        }
        const rec = await recurrences.add({ data: { ...WS_STAMP, ...recDoc } })
        await addSessions(toCreate, { _id: rec._id, ...recDoc }, ctx)
        // 批量只写一条汇总，不写 N 条
        const nmRes = await students.where({ _id: _.in(studentIds) }).get()
        const nmMap = {}
        nmRes.data.forEach((s) => (nmMap[s._id] = s.name))
        await addNotification({
          ownerId: ctx.openid,
          type: 'sessionCreate',
          title: '批量排课',
          body: `${ct.courseTypeName} · ${studentsLabel(
            studentIds.map((id) => nmMap[id]).filter(Boolean)
          )}，生成 ${toCreate.length} 节课`,
          refType: null,
          refId: null
        })
        return ok({ _id: rec._id, generated: toCreate.length, skipped: mode === 'skip' ? conflicts.length : 0 })
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
        if (data.courseTypeId !== undefined || data.courseType !== undefined) {
          const ct = await resolveCourseType(data, ctx, true)
          patch.courseType = ct.legacyType
          patch.courseTypeId = ct.courseTypeId
          patch.courseTypeName = ct.courseTypeName
        }
        if (data.weekdays !== undefined) {
          if (!Array.isArray(data.weekdays) || !data.weekdays.every((w) => Number.isInteger(w) && w >= 0 && w <= 6)) {
            return fail(40001, '星期取值无效')
          }
          patch.weekdays = data.weekdays
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
          merged.weekdays || (Number.isInteger(merged.weekday) ? [merged.weekday] : []),
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
