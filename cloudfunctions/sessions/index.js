const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')
const { WS_STAMP, WORKSPACE_DEFAULT } = require('./_shared/workspace')
const {
  sendSubscribe,
  lowCreditData,
  creditDeductData,
  TEMPLATES,
  studentsLabel,
  envToState
} = require('./_shared/subscribe')
const { addNotification } = require('./_shared/notify')

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate
const sessions = db.collection('classSessions')
const students = db.collection('students')
const courseTypesCol = db.collection('courseTypes')

const LOW_CREDIT_THRESHOLD = 2
const LEGACY_LABEL = { makeup: '补课', cambridge: '剑桥课程' }

// 解析课程类型：优先 courseTypeId（新），回退 courseType 字符串（旧兼容）。
// 返回 { courseTypeId, courseTypeName（快照）, legacyType, defaultDur }。requireActive=建课时校验停用。
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

// 累加该学员所有流水的 delta = 当前余额
async function computeBalance(studentId) {
  const r = await db
    .collection('creditLogs')
    .aggregate()
    .match({ studentId })
    .group({ _id: null, total: $.sum('$delta') })
    .end()
  return r.list && r.list[0] ? r.list[0].total : 0
}

// 学员集合 → 「前2人+等N人」标签（消息快照用，≤20 字）
async function namesLabel(studentIds) {
  if (!studentIds || !studentIds.length) return '学员'
  const r = await students.where({ _id: _.in(studentIds) }).get()
  const map = {}
  r.data.forEach((s) => (map[s._id] = s.name))
  return studentsLabel(studentIds.map((id) => map[id]).filter(Boolean))
}

// 毫秒 → 北京时间「M/D HH:mm」（消息里的短时间）
function fmtShort(ms) {
  const d = new Date(ms + 8 * 3600000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

// 课时变动后检查：首次跌破 ≤阈值且未通知过 → 发课时不足提醒给老师；余额回升则清标记以便下次再触发。
// 用 students.lowCreditNotified 布尔标记去重，保证「首次跌破」只发一次。发送失败不影响主流程。
async function checkLowCredit(studentId, ownerId, knownBalance, miniprogramState) {
  try {
    const sres = await students.where({ _id: studentId }).get()
    const stu = sres.data[0]
    if (!stu) return
    const balance = knownBalance !== undefined ? knownBalance : await computeBalance(studentId)
    if (balance <= LOW_CREDIT_THRESHOLD) {
      if (stu.lowCreditNotified === true) return // 已通知过，不重复
      await sendSubscribe({
        touser: ownerId,
        templateId: TEMPLATES.lowCredit,
        page: `pages/students/detail/index?id=${studentId}`,
        data: lowCreditData({ name: stu.name, balance, atMs: Date.now() }),
        kind: 'lowCredit',
        refId: studentId,
        miniprogramState
      })
      // 应用内消息兜底（与 lowCreditNotified 同一去重口径）
      await addNotification({
        ownerId,
        type: 'lowCredit',
        title: '课时不足',
        body: `${stu.name} 剩余 ${balance} 课时，请及时续费`,
        refType: 'student',
        refId: studentId
      })
      await students.doc(studentId).update({ data: { lowCreditNotified: true } })
    } else if (stu.lowCreditNotified === true) {
      await students.doc(studentId).update({ data: { lowCreditNotified: false } })
    }
  } catch (e) {
    console.error('[checkLowCredit] 失败', studentId, e && e.message)
  }
}

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
  // 二期学员归工作室：任一 owner/teacher 都能给本工作室学员排课，不再按 ownerId 限制
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

// 冲突检测：二期按 workspaceId 全局（跨所有老师），返回与 [start, start+dur) 相交的其它课。
// 相交判定 A.start < B.end && B.start < A.end；首尾相接不算冲突。ownerId 入参已不用于过滤。
async function findConflicts(ownerId, startTime, durationMin, excludeId) {
  const start = new Date(startTime).getTime()
  const end = start + durationMin * 60000
  const winStart = new Date(start - 4 * 60 * 60000) // 回溯 4h，足够覆盖任何时长的候选课
  const res = await sessions
    .where({
      workspaceId: WORKSPACE_DEFAULT,
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

// 冲突里是否有「同一学员」重叠（硬冲突，数据错误，不允许强建）。返回该学员 id 或 null
function sharedStudentConflict(conflicts, studentIds) {
  const set = new Set(studentIds || [])
  for (const c of conflicts) {
    const hit = (c.studentIds || []).find((sid) => set.has(sid))
    if (hit) return hit
  }
  return null
}

async function studentNameById(id) {
  const r = await students.where({ _id: id }).get()
  return (r.data[0] && r.data[0].name) || '该学员'
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 新建单次课，studentIds 支持多人（小班课）。冲突默认阻止，force=true 可强建
      case 'create': {
        if (!data.startTime) return fail(40001, '缺少开始时间')
        const ct = await resolveCourseType(data, ctx, true)
        const durationMin = Number(data.durationMin) || ct.defaultDur
        if (durationMin <= 0) return fail(40001, '时长无效')
        await assertStudentsOwned(data.studentIds, ctx)

        const conflicts = await findConflicts(ctx.openid, data.startTime, durationMin, null)
        const hardSid = sharedStudentConflict(conflicts, data.studentIds)
        if (hardSid) {
          const name = await studentNameById(hardSid)
          return fail(40902, `${name} 在该时段已有课程，无法重复排课`)
        }
        if (conflicts.length && data.force !== true) {
          return fail(40901, '该时段与已有课程冲突', { conflicts })
        }

        const doc = {
          ownerId: ctx.openid,
          courseType: ct.legacyType,
          courseTypeId: ct.courseTypeId,
          courseTypeName: ct.courseTypeName,
          startTime: new Date(data.startTime),
          durationMin,
          status: 'scheduled',
          recurrenceId: data.recurrenceId || null,
          studentIds: data.studentIds,
          attendance: {},
          note: data.note || '',
          createdAt: db.serverDate()
        }
        const res = await sessions.add({ data: { ...WS_STAMP, ...doc } })
        await addNotification({
          ownerId: ctx.openid,
          type: 'sessionCreate',
          title: '新建课程',
          body: `${await namesLabel(data.studentIds)} · ${ct.courseTypeName}，${fmtShort(
            new Date(data.startTime).getTime()
          )}`,
          refType: 'session',
          refId: res._id
        })
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
        const skip = Number(data.skip) || 0
        const res = await sessions
          .where(where)
          .orderBy('startTime', 'asc')
          .skip(skip)
          .limit(100)
          .get()
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

        if (data.courseTypeId !== undefined || data.courseType !== undefined) {
          const ct = await resolveCourseType(data, ctx, true)
          patch.courseType = ct.legacyType
          patch.courseTypeId = ct.courseTypeId
          patch.courseTypeName = ct.courseTypeName
        }
        if (data.durationMin !== undefined) {
          nextDuration = Number(data.durationMin)
          if (nextDuration <= 0) return fail(40001, '时长无效')
          patch.durationMin = nextDuration
        }
        if (data.startTime !== undefined) {
          nextStart = new Date(data.startTime)
          patch.startTime = nextStart
          // 改期后重置课前提醒标记，让定时器按新时间重新提醒
          patch.classReminderSentAt = _.remove()
        }
        if (data.studentIds !== undefined) {
          await assertStudentsOwned(data.studentIds, ctx)
          patch.studentIds = data.studentIds
        }
        if (data.note !== undefined) patch.note = data.note

        if (data.startTime !== undefined || data.durationMin !== undefined) {
          const conflicts = await findConflicts(ctx.openid, nextStart, nextDuration, doc._id)
          const nextStudents = data.studentIds !== undefined ? data.studentIds : doc.studentIds
          const hardSid = sharedStudentConflict(conflicts, nextStudents)
          if (hardSid) {
            const name = await studentNameById(hardSid)
            return fail(40902, `${name} 在该时段已有课程，无法重复排课`)
          }
          if (conflicts.length && data.force !== true) {
            return fail(40901, '该时段与已有课程冲突', { conflicts })
          }
        }
        await sessions.doc(doc._id).update({ data: patch })
        if (data.startTime !== undefined) {
          const oldMs = new Date(doc.startTime).getTime()
          const newMs = nextStart.getTime()
          if (oldMs !== newMs) {
            await addNotification({
              ownerId: ctx.openid,
              type: 'sessionReschedule',
              title: '课程改期',
              body: `${await namesLabel(patch.studentIds || doc.studentIds)} 的课 从 ${fmtShort(
                oldMs
              )} 改到 ${fmtShort(newMs)}`,
              refType: 'session',
              refId: doc._id
            })
          }
        }
        return ok({ _id: doc._id, ...patch })
      }

      // 取消（仅未上课）。不涉及课时
      case 'cancel': {
        const doc = await loadOwned(data.id, ctx)
        if (doc.status !== 'scheduled') return fail(40002, '仅未上课的课程可取消')
        await sessions.doc(doc._id).update({ data: { status: 'cancelled' } })
        await addNotification({
          ownerId: ctx.openid,
          type: 'sessionCancel',
          title: '取消课程',
          body: `取消 ${await namesLabel(doc.studentIds)} ${fmtShort(
            new Date(doc.startTime).getTime()
          )} 的课`,
          refType: 'session',
          refId: doc._id
        })
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
                data: { ...WS_STAMP, studentId: sid, sessionId: doc._id, delta: -1, reason: 'attend', createdAt: now }
              })
            }
          }
          await transaction
            .collection('classSessions')
            .doc(doc._id)
            .update({ data: { status: 'completed', attendance } })
        })
        // 扣课时后检查余额，首次跌破 ≤2 发课时不足提醒（事务外，失败不影响完成结果）
        // 逐人扣课时已在事务内完成。事务外：算余额 + 低课时检查 + 汇总（一条应用内消息 + 一条推送）
        const state = envToState(event.envVersion)
        const presentSids = doc.studentIds.filter((sid) => attendance[sid] === 'present')
        const names = []
        let singleBalance = 0
        for (const sid of presentSids) {
          const bal = await computeBalance(sid)
          names.push(await studentNameById(sid))
          if (presentSids.length === 1) singleBalance = bal
          await checkLowCredit(sid, ctx.openid, bal, state)
        }
        if (presentSids.length) {
          const count = presentSids.length
          const body = count === 1 ? `${names[0]} 扣 1 课时，剩余 ${singleBalance}` : `本节课 ${count} 人各扣 1 课时`
          // 应用内一条汇总
          await addNotification({
            ownerId: ctx.openid,
            type: 'creditDeduct',
            title: '扣课时',
            body,
            refType: 'session',
            refId: doc._id
          })
          // 订阅推送一条汇总（item 3：每次扣课时提醒；一节课多人合并，不炸多条）
          await sendSubscribe({
            touser: ctx.openid,
            templateId: TEMPLATES.lowCredit,
            page: `pages/course/detail/index?id=${doc._id}`,
            data: creditDeductData({ names, count, singleBalance, atMs: Date.now() }),
            kind: 'creditDeduct',
            refId: doc._id,
            miniprogramState: state
          })
        }
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
                  data: { ...WS_STAMP, studentId: sid, sessionId: doc._id, delta: 1, reason: 'revert', createdAt: now }
                })
              }
            }
            await transaction
              .collection('classSessions')
              .doc(doc._id)
              .update({ data: { status: 'scheduled', attendance: {} } })
          })
          // 回退 +1 后余额回升，可能越过阈值 → 清除课时不足标记，便于下次再触发
          const att0 = doc.attendance || {}
          for (const sid of Object.keys(att0)) {
            if (att0[sid] === 'present') {
              await checkLowCredit(sid, ctx.openid, undefined, envToState(event.envVersion))
            }
          }
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
