/**
 * ⚠️⚠️ 临时函数——造测试数据用。诊断/验收完请立即删除本云函数（seedTestData）。⚠️⚠️
 *
 * 模拟真实规模：25 学员（含同名 Amy×3 / Leo×2 测同名场景），每人 2-3 条充值、6-10 节课，
 * 过去的课标完成并产生扣课时流水。时间分布：过去一个月 ~ 未来两周。creditLogs 约 200-400 条。
 * 所有数据带 ownerId（传 ownerId 用之，否则用调用者 openid）。
 *
 * 安全阀：必须传 { confirm:'YES_SEED_DATA' }。
 * 调用：云开发控制台 → 云函数 → seedTestData → 云端测试，参数：
 *   { "confirm":"YES_SEED_DATA", "ownerId":"<你的 openid>" }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const CONFIRM = 'YES_SEED_DATA'
const DAY = 86400000

const COURSES = [
  { slug: 'cambridge', name: '剑桥课程', dur: 120 },
  { slug: 'makeup', name: '补课', dur: 90 }
]

// 25 个名字，含同名：Amy×3、Leo×2
const NAMES = []
for (let i = 1; i <= 20; i++) NAMES.push('Student' + String(i).padStart(2, '0'))
NAMES.push('Amy', 'Amy', 'Amy', 'Leo', 'Leo')

// 同名学员给不同中文名（aliasCn，二期显示区分用；现在只存不显）
const ALIAS = { Amy: ['王小美', '李爱米', '陈安琪'], Leo: ['刘乐', '赵磊'] }

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// 造一个"北京时间某天某点"的 Date：距今 offsetDays 天，北京 bjHour:mm
function bjDateAt(nowMs, offsetDays, bjHour, minute) {
  const bj = new Date(nowMs + offsetDays * DAY + 8 * 3600000)
  return new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate(), bjHour - 8, minute, 0))
}

exports.main = async (event = {}) => {
  if (event.confirm !== CONFIRM) {
    return { code: 40001, msg: `未确认：必须传 confirm:'${CONFIRM}'，当前未创建任何数据` }
  }
  const { OPENID } = cloud.getWXContext()
  const ownerId = event.ownerId || OPENID
  if (!ownerId) return { code: 40001, msg: '缺少 ownerId' }

  const now = Date.now()
  const counts = { students: 0, packages: 0, sessions: 0, completed: 0, creditLogs: 0 }
  const aliasCounter = {}

  for (const name of NAMES) {
    let aliasCn = ''
    if (ALIAS[name]) {
      const k = aliasCounter[name] || 0
      aliasCn = ALIAS[name][k] || ''
      aliasCounter[name] = k + 1
    }

    const stu = await db.collection('students').add({
      data: {
        ownerId,
        name,
        aliasCn,
        levelTag: pick(['KET', 'PET', '启蒙', '']),
        note: '',
        isDeleted: false,
        createdAt: db.serverDate()
      }
    })
    const studentId = stu._id
    counts.students++

    // 充值 2-3 次
    const nPkg = rnd(2, 3)
    for (let p = 0; p < nPkg; p++) {
      const credits = pick([10, 20, 30])
      const at = bjDateAt(now, -rnd(5, 30), rnd(9, 20), 0)
      await db.collection('packages').add({
        data: { ownerId, studentId, totalCredits: credits, purchasedAt: at, note: '现金' }
      })
      counts.packages++
      await db.collection('creditLogs').add({
        data: { studentId, sessionId: null, delta: credits, reason: 'purchase', createdAt: at }
      })
      counts.creditLogs++
    }

    // 6-10 节课；过去的完成（产生扣课时），未来的待上课
    const nSess = rnd(6, 10)
    for (let s = 0; s < nSess; s++) {
      const c = pick(COURSES)
      const start = bjDateAt(now, rnd(-30, 14), rnd(9, 19), pick([0, 30]))
      const isPast = start.getTime() < now
      const status = isPast ? 'completed' : 'scheduled'
      await db.collection('classSessions').add({
        data: {
          ownerId,
          courseType: c.slug,
          courseTypeId: null,
          courseTypeName: c.name,
          startTime: start,
          durationMin: c.dur,
          status,
          recurrenceId: null,
          studentIds: [studentId],
          attendance: isPast ? { [studentId]: 'present' } : {},
          note: '',
          createdAt: db.serverDate()
        }
      })
      counts.sessions++
      if (isPast) {
        counts.completed++
        await db.collection('creditLogs').add({
          data: { studentId, sessionId: null, delta: -1, reason: 'attend', createdAt: start }
        })
        counts.creditLogs++
      }
    }
  }

  console.log('[seedTestData]', JSON.stringify(counts))
  return { code: 0, data: counts }
}
