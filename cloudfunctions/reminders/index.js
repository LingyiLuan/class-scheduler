const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')
const {
  TEMPLATES,
  classReminderData,
  lowCreditData,
  sendSubscribe,
  studentsLabel,
  fmtBjTime
} = require('./_shared/subscribe')
const { addNotification } = require('./_shared/notify')

const db = cloud.database()
const _ = db.command
const sessions = db.collection('classSessions')
const students = db.collection('students')

// 调试入口总开关：上线前置 false，关闭手动触发发送。本地开发临时测试时改回 true
const ALLOW_DEBUG = false

// 定时器发送课前提醒的 miniprogramState。定时触发无前端上下文，无法读 envVersion，故用配置项：
//   体验测试期 = 'trial'；正式发布后改 'formal'。（前端触发的消息走 envVersion 动态判断，不看这里）
const TIMER_MINIPROGRAM_STATE = 'trial'

// 取一节课的学员名（保持传入顺序）
async function studentNames(studentIds) {
  if (!studentIds || !studentIds.length) return []
  const r = await students.where({ _id: _.in(studentIds) }).get()
  const map = {}
  r.data.forEach((s) => (map[s._id] = s.name))
  return studentIds.map((id) => map[id]).filter(Boolean)
}

// 给一节课发课前提醒（发给课程 ownerId）。成功失败都标记 classReminderSentAt，避免定时器重复扫到
async function remindSession(s) {
  const names = await studentNames(s.studentIds)
  const startMs = new Date(s.startTime).getTime()
  const outcome = await sendSubscribe({
    touser: s.ownerId,
    templateId: TEMPLATES.classReminder,
    page: `pages/course/detail/index?id=${s._id}`,
    data: classReminderData({
      startMs,
      courseType: s.courseType,
      courseTypeName: s.courseTypeName,
      names,
      durationMin: s.durationMin
    }),
    kind: 'classReminder',
    refId: s._id,
    miniprogramState: TIMER_MINIPROGRAM_STATE
  })
  await sessions.doc(s._id).update({
    data: {
      classReminderSentAt: db.serverDate(),
      classReminderResult: outcome.ok ? 'ok' : `err:${outcome.errCode}`
    }
  })
  // 应用内消息兜底：无论推送是否成功都写一条（与 classReminderSentAt 同一去重口径）
  await addNotification({
    ownerId: s.ownerId,
    type: 'classReminder',
    title: '课前提醒',
    body: `${fmtBjTime(startMs)} ${s.courseTypeName || '课程'} · ${studentsLabel(names)}，距上课约 1 小时`,
    refType: 'session',
    refId: s._id
  })
  return outcome
}

// 定时扫描：未来 [50,60) 分钟内、scheduled、未发过提醒的课
async function scanAndRemind() {
  const now = Date.now()
  const from = new Date(now + 50 * 60000)
  const to = new Date(now + 60 * 60000)
  const res = await sessions
    .where({
      status: 'scheduled',
      startTime: _.gte(from).and(_.lt(to)),
      classReminderSentAt: _.exists(false)
    })
    .limit(100)
    .get()
  console.log(
    `[reminders.scan] 窗口 ${from.toISOString()} ~ ${to.toISOString()}，命中 ${res.data.length} 节待提醒`
  )
  const results = []
  for (const s of res.data) {
    const o = await remindSession(s)
    results.push({ sessionId: s._id, ok: o.ok, errCode: o.errCode })
  }
  console.log(`[reminders.scan] 完成，发送 ${results.length} 条`, JSON.stringify(results))
  return results
}

exports.main = async (event = {}) => {
  const { action } = event
  try {
    // ——— 调试入口：真机手动触发，无需等定时器（仅 owner/teacher，发给调用者自己）———
    if (action === 'debugSendClassReminder' || action === 'debugSendLowCredit') {
      if (!ALLOW_DEBUG) return fail(40301, '调试入口已关闭')
      const ctx = await requireRole(['owner', 'teacher'])
      const data = event.data || {}
      // 真机调试常用开发版，需 'developer'；体验版传 'trial'；正式版 'formal'
      const state = data.state || 'developer'

      if (action === 'debugSendClassReminder') {
        let list
        if (data.sessionId) {
          const r = await sessions.where({ _id: data.sessionId }).get()
          list = r.data
        } else {
          const now = Date.now()
          const r = await sessions
            .where({
              ownerId: ctx.openid,
              status: 'scheduled',
              startTime: _.gte(new Date(now)).and(_.lt(new Date(now + 2 * 3600000)))
            })
            .orderBy('startTime', 'asc')
            .limit(3)
            .get()
          list = r.data
        }
        console.log(`[reminders.debug] 课前提醒，state=${state}，候选 ${list.length} 节`)
        if (!list.length) return ok({ sent: 0, note: '未来 2 小时内没有待上课的课程可测试（可先建一节近的课）' })
        const results = []
        for (const s of list) {
          const names = await studentNames(s.studentIds)
          const o = await sendSubscribe({
            touser: ctx.openid, // 发给自己便于测试
            templateId: TEMPLATES.classReminder,
            page: `pages/course/detail/index?id=${s._id}`,
            data: classReminderData({
              startMs: new Date(s.startTime).getTime(),
              courseType: s.courseType,
              courseTypeName: s.courseTypeName,
              names,
              durationMin: s.durationMin
            }),
            kind: 'classReminder-debug',
            refId: s._id,
            miniprogramState: state
          })
          results.push({ sessionId: s._id, ok: o.ok, errCode: o.errCode, errMsg: o.errMsg })
        }
        return ok({ sent: results.filter((r) => r.ok).length, total: results.length, results })
      }

      // debugSendLowCredit
      let stu
      if (data.studentId) {
        const r = await students.where({ _id: data.studentId }).get()
        stu = r.data[0]
      } else {
        const r = await students.where({ ownerId: ctx.openid, isDeleted: _.neq(true) }).limit(1).get()
        stu = r.data[0]
      }
      console.log(`[reminders.debug] 课时不足，state=${state}，学员=${stu && stu.name}`)
      if (!stu) return ok({ sent: 0, note: '没有可测试的学员' })
      const o = await sendSubscribe({
        touser: ctx.openid,
        templateId: TEMPLATES.lowCredit,
        page: `pages/students/detail/index?id=${stu._id}`,
        data: lowCreditData({ name: stu.name, balance: 2, atMs: Date.now() }),
        kind: 'lowCredit-debug',
        refId: stu._id,
        miniprogramState: state
      })
      return ok({ sent: o.ok ? 1 : 0, result: o })
    }

    // ——— 默认路径：定时触发器（无用户上下文，不鉴权）———
    const results = await scanAndRemind()
    return ok({ scanned: results.length, results })
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    console.error('[reminders] 异常', e && e.stack)
    return fail(50000, (e && e.message) || '服务异常')
  }
}
