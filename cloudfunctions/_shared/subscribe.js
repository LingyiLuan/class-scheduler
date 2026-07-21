/**
 * 订阅消息共享配置与发送。sync:cloud 复制进各云函数目录后 require('./_shared/subscribe')。
 * 依赖调用方 index.js 已执行 cloud.init()。
 *
 * 模板 ID 必须与前端 src/constants/subscribe.ts 保持一致（两处同一份定义）。
 * 字段 key 与类型来自小程序后台申请到的模板，严格对应，长度超限会发送失败，故做截断保护：
 *   - thing        ≤ 20 字符
 *   - short_thing  ≤ 5  字符（比 thing 严格得多）
 *   - time         日期时间字符串
 */
const cloud = require('wx-server-sdk')

const TEMPLATES = {
  // 课前提醒：time6 上课时间 / thing12 课程 / thing15 学员 / thing4 备注
  classReminder: 'pQI8sXDGRuMoX9T8g8OwUUvZeOpw9nZVqe9bULcl25Q',
  // 课时不足：thing7 学员 / short_thing3 剩余课时(≤5) / time4 扣减时间 / thing5 备注
  lowCredit: 'QAHo3VnPf6lKB9UKKCtbHqHC5Sa8dlamf96qbuXLnsc'
}

const COURSE_LABEL = { cambridge: '剑桥课程', makeup: '补课' }

// 截断到 n 字符（超限会导致 subscribeMessage.send 失败）
function clip(s, n) {
  s = String(s == null ? '' : s)
  return s.length > n ? s.slice(0, n) : s
}

// 毫秒 → 北京时间 "YYYY-MM-DD HH:mm"（time 类型字段）
function fmtBjTime(ms) {
  const d = new Date(ms + 8 * 3600000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(
    d.getUTCMinutes()
  )}`
}

// 学员名列表 → 「前2人 + 等N人」，≤20 字符
function studentsLabel(names) {
  const arr = (names || []).filter(Boolean)
  if (!arr.length) return '学员'
  if (arr.length <= 2) return clip(arr.join('、'), 20)
  return clip(`${arr[0]}、${arr[1]} 等${arr.length}人`, 20)
}

// 课前提醒字段值
function classReminderData({ startMs, courseType, names, durationMin }) {
  const cnt = (names || []).length
  return {
    time6: { value: fmtBjTime(startMs) },
    thing12: { value: clip(COURSE_LABEL[courseType] || courseType || '课程', 20) },
    thing15: { value: studentsLabel(names) },
    thing4: { value: clip(`${durationMin || 0}分钟 · ${cnt > 1 ? '小班课' : '一对一'}`, 20) }
  }
}

// 课时不足字段值（short_thing3 限 5 字符，务必截断）
function lowCreditData({ name, balance, atMs }) {
  return {
    thing7: { value: clip(name || '学员', 20) },
    short_thing3: { value: clip(`${balance}课时`, 5) },
    time4: { value: fmtBjTime(atMs) },
    thing5: { value: clip('课时不足，请及时续费', 20) }
  }
}

/**
 * 统一发送订阅消息 + 记录结果（成功失败都写 notifyLogs 与 console，绝不静默失败）。
 * @param {object} o
 * @param {string} o.touser      接收者 openid
 * @param {string} o.templateId
 * @param {object} o.data        字段值
 * @param {string} [o.page]      点击跳转页
 * @param {string} [o.kind]      分类（日志用）：classReminder / lowCredit / *-debug
 * @param {string} [o.refId]     关联业务 id（sessionId / studentId）
 * @param {string} [o.miniprogramState] 'developer' | 'trial' | 'formal'（默认 formal）
 * @returns {Promise<{ok:boolean, errCode:number, errMsg:string}>}
 */
async function sendSubscribe({ touser, templateId, data, page, kind, refId, miniprogramState }) {
  const db = cloud.database()
  let outcome
  try {
    const payload = { touser, templateId, data }
    if (page) payload.page = page
    if (miniprogramState) payload.miniprogramState = miniprogramState
    const r = await cloud.openapi.subscribeMessage.send(payload)
    outcome = { ok: true, errCode: (r && r.errCode) || 0, errMsg: (r && r.errMsg) || 'ok' }
  } catch (e) {
    // 常见 errCode：43101 用户未授权/额度已耗尽；47003 参数格式不符；40003 openid 错误
    outcome = {
      ok: false,
      errCode: e && e.errCode != null ? e.errCode : -1,
      errMsg: (e && (e.errMsg || e.message)) || String(e)
    }
  }
  console.log(
    `[subscribe.send] kind=${kind} touser=${touser} tmpl=${templateId} refId=${refId || ''} ` +
      `ok=${outcome.ok} errCode=${outcome.errCode} errMsg=${outcome.errMsg}`
  )
  try {
    await db.collection('notifyLogs').add({
      data: {
        kind: kind || 'unknown',
        touser,
        templateId,
        refId: refId || null,
        ok: outcome.ok,
        errCode: outcome.errCode,
        errMsg: outcome.errMsg,
        dataSnapshot: data,
        createdAt: db.serverDate()
      }
    })
  } catch (le) {
    console.error('[subscribe.log] 写 notifyLogs 失败', le && le.message)
  }
  return outcome
}

module.exports = {
  TEMPLATES,
  COURSE_LABEL,
  clip,
  fmtBjTime,
  studentsLabel,
  classReminderData,
  lowCreditData,
  sendSubscribe
}
