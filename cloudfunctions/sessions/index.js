const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
const _ = db.command
const sessions = db.collection('classSessions')
const students = db.collection('students')

const COURSE_DEFAULT_DURATION = { makeup: 90, cambridge: 120 }
// 占用时段（参与冲突检测）的状态；cancelled 不占用
const ACTIVE_STATUSES = ['scheduled', 'completed', 'absent']

// 校验学员集合存在且归调用者
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

async function loadOwned(id, ctx) {
  if (!id) throw new AuthError(40001, '缺少课程 id')
  const res = await sessions.where({ _id: id }).get()
  const doc = res.data[0]
  if (!doc) throw new AuthError(40400, '课程不存在')
  if (ctx.user.role !== 'owner' && doc.ownerId !== ctx.openid) {
    throw new AuthError(40301, '无权操作该课程')
  }
  return doc
}

// 冲突检测：老师单资源，返回与 [start, start+dur) 时间区间相交的其它课
// 相交判定 A.start < B.end && B.start < A.end；首尾相接不算冲突
async function findConflicts(ownerId, startTime, durationMin, excludeId) {
  const start = new Date(startTime).getTime()
  const end = start + durationMin * 60000
  const winStart = new Date(start - 4 * 60 * 60000) // 回溯 4h，足够覆盖任何时长的候选课
  const res = await sessions
    .where({
      ownerId,
      status: _.in(ACTIVE_STATUSES),
      startTime: _.gte(winStart).and(_.lt(new Date(end)))
    })
    .get()
  return res.data.filter((s) => {
    if (s._id === excludeId) return false
    const sStart = new Date(s.startTime).getTime()
    const sEnd = sStart + (s.durationMin || 0) * 60000
    return sStart < end && start < sEnd
  })
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 新建单次课，studentIds 支持多人（小班课）。冲突默认阻止，force=true 可强建
      case 'create': {
        const { courseType } = data
        if (!COURSE_DEFAULT_DURATION[courseType]) return fail(40001, '课程类型无效')
        if (!data.startTime) return fail(40001, '缺少开始时间')
        const durationMin = Number(data.durationMin) || COURSE_DEFAULT_DURATION[courseType]
        if (durationMin <= 0) return fail(40001, '时长无效')
        await assertStudentsOwned(data.studentIds, ctx)

        const conflicts = await findConflicts(ctx.openid, data.startTime, durationMin, null)
        if (conflicts.length && data.force !== true) {
          return fail(40901, '该时段与已有课程冲突', { conflicts })
        }

        const doc = {
          ownerId: ctx.openid,
          courseType,
          startTime: new Date(data.startTime),
          durationMin,
          status: 'scheduled',
          recurrenceId: data.recurrenceId || null,
          studentIds: data.studentIds,
          attendance: {},
          note: data.note || '',
          createdAt: db.serverDate()
        }
        const res = await sessions.add({ data: doc })
        return ok({ _id: res._id, ...doc })
      }

      // 周视图等：按时间区间 [from, to) 列出本人课程
      case 'list': {
        const where = { ownerId: ctx.openid }
        if (data.from && data.to) {
          where.startTime = _.gte(new Date(data.from)).and(_.lt(new Date(data.to)))
        } else if (data.from) {
          where.startTime = _.gte(new Date(data.from))
        } else if (data.to) {
          where.startTime = _.lt(new Date(data.to))
        }
        const res = await sessions.where(where).orderBy('startTime', 'asc').limit(100).get()
        return ok({ list: res.data })
      }

      case 'get': {
        const doc = await loadOwned(data.id, ctx)
        return ok(doc)
      }

      // 编辑单节（仅未上课）。改时间/时长需重跑冲突检测
      case 'update': {
        const doc = await loadOwned(data.id, ctx)
        if (doc.status !== 'scheduled') return fail(40002, '仅未上课的课程可编辑')

        const patch = {}
        let nextDuration = doc.durationMin
        let nextStart = doc.startTime

        if (data.courseType !== undefined) {
          if (!COURSE_DEFAULT_DURATION[data.courseType]) return fail(40001, '课程类型无效')
          patch.courseType = data.courseType
        }
        if (data.durationMin !== undefined) {
          nextDuration = Number(data.durationMin)
          if (nextDuration <= 0) return fail(40001, '时长无效')
          patch.durationMin = nextDuration
        }
        if (data.startTime !== undefined) {
          nextStart = new Date(data.startTime)
          patch.startTime = nextStart
        }
        if (data.studentIds !== undefined) {
          await assertStudentsOwned(data.studentIds, ctx)
          patch.studentIds = data.studentIds
        }
        if (data.note !== undefined) patch.note = data.note

        if (data.startTime !== undefined || data.durationMin !== undefined) {
          const conflicts = await findConflicts(ctx.openid, nextStart, nextDuration, doc._id)
          if (conflicts.length && data.force !== true) {
            return fail(40901, '该时段与已有课程冲突', { conflicts })
          }
        }
        await sessions.doc(doc._id).update({ data: patch })
        return ok({ _id: doc._id, ...patch })
      }

      // 取消（仅未上课）。不涉及课时
      case 'cancel': {
        const doc = await loadOwned(data.id, ctx)
        if (doc.status !== 'scheduled') return fail(40002, '仅未上课的课程可取消')
        await sessions.doc(doc._id).update({ data: { status: 'cancelled' } })
        return ok({ _id: doc._id, status: 'cancelled' })
      }

      // 标记完成：为每个出席学员各扣 1 次。幂等——仅 scheduled 可完成，防重复扣课时
      // attendance 里标 absent 的是「小班课里某个学员没来」，不扣（区别于整节 markAbsent）
      case 'complete': {
        const doc = await loadOwned(data.id, ctx)
        if (doc.status !== 'scheduled') return fail(40002, '仅未上课的课程可标记完成')

        const attendance = {}
        for (const sid of doc.studentIds) {
          const mark = data.attendance && data.attendance[sid]
          attendance[sid] = mark === 'absent' ? 'absent' : 'present'
        }
        const now = db.serverDate()
        await db.runTransaction(async (transaction) => {
          const fresh = await transaction.collection('classSessions').doc(doc._id).get()
          if (!fresh.data || fresh.data.status !== 'scheduled') {
            throw new AuthError(40002, '课程状态已变化，请刷新')
          }
          for (const sid of doc.studentIds) {
            if (attendance[sid] === 'present') {
              await transaction.collection('creditLogs').add({
                data: { studentId: sid, sessionId: doc._id, delta: -1, reason: 'attend', createdAt: now }
              })
            }
          }
          await transaction
            .collection('classSessions')
            .doc(doc._id)
            .update({ data: { status: 'completed', attendance } })
        })
        return ok({ _id: doc._id, status: 'completed', attendance })
      }

      // 整节缺勤：整节课没上（区别于 complete 里个别学员 attendance='absent'）。
      // 两种都不扣课时（请假一律不扣），但语义不同：此处是整节，那里是小班课个别学员。
      case 'markAbsent': {
        const doc = await loadOwned(data.id, ctx)
        if (doc.status !== 'scheduled') return fail(40002, '仅未上课的课程可标记缺勤')
        await sessions.doc(doc._id).update({ data: { status: 'absent' } })
        return ok({ _id: doc._id, status: 'absent' })
      }

      // 撤销回 scheduled。仅 completed 才写反向流水（防重复撤销），absent/cancelled 直接回退
      case 'reopen': {
        const doc = await loadOwned(data.id, ctx)
        if (doc.status === 'scheduled') return fail(40002, '课程未结束，无需撤销')

        if (doc.status === 'completed') {
          const now = db.serverDate()
          await db.runTransaction(async (transaction) => {
            const fresh = await transaction.collection('classSessions').doc(doc._id).get()
            if (!fresh.data || fresh.data.status !== 'completed') {
              throw new AuthError(40002, '课程状态已变化，请刷新')
            }
            // 按完成时的 attendance 出席学员逐个写 +1 revert，与 complete 的扣减一一对应；
            // 不删原始 attend 流水（append-only）。随后清空 attendance 回到 scheduled。
            const att = fresh.data.attendance || {}
            for (const sid of Object.keys(att)) {
              if (att[sid] === 'present') {
                await transaction.collection('creditLogs').add({
                  data: { studentId: sid, sessionId: doc._id, delta: 1, reason: 'revert', createdAt: now }
                })
              }
            }
            await transaction
              .collection('classSessions')
              .doc(doc._id)
              .update({ data: { status: 'scheduled', attendance: {} } })
          })
          return ok({ _id: doc._id, status: 'scheduled' })
        }

        // absent / cancelled：本就未扣课时，直接回退
        await sessions.doc(doc._id).update({ data: { status: 'scheduled' } })
        return ok({ _id: doc._id, status: 'scheduled' })
      }

      // 某学员的历史课程（studentIds 数组包含该学员），按时间倒序
      case 'listByStudent': {
        if (!data.studentId) return fail(40001, '缺少学员 id')
        const where = { studentIds: data.studentId }
        if (ctx.user.role !== 'owner') where.ownerId = ctx.openid
        const res = await sessions.where(where).orderBy('startTime', 'desc').limit(100).get()
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
