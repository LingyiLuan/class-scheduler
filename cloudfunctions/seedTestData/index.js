/**
 * ⚠️⚠️ 临时函数——造测试数据用。诊断/验收完请立即删除本云函数（seedTestData）。⚠️⚠️
 *
 * 模拟真实规模：25 学员（含同名 Amy×3 / Leo×2），每人 2-3 充值、8-12 节课，
 * 过去的课标完成并产生扣课时流水。时间分布：过去一个月 ~ 未来两周。
 *
 * 3 秒超时对策：并发写（Promise.all，分块限流）+ 支持按学员区间分批。
 * 参数：
 *   confirm  必须 'YES_SEED_DATA'
 *   ownerId  你的 openid（不传则用调用者）
 *   from,to  可选，只造 NAMES[from,to) 这一段学员。默认造全部 25 个。
 *            若整批仍超时，分几次调：{from:0,to:9}、{from:9,to:18}、{from:18,to:25}
 * 返回本次各类新建条数。
 * 云端测试示例：{ "confirm":"YES_SEED_DATA", "ownerId":"<你的openid>", "from":0, "to":9 }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const CONFIRM = 'YES_SEED_DATA'
const DAY = 86400000
const CHUNK = 40 // 单轮并发写上限，防连接数打满

const COURSES = [
  { slug: 'cambridge', name: '剑桥课程', dur: 120 },
  { slug: 'makeup', name: '补课', dur: 90 }
]

// 25 个名字，含同名：Amy×3、Leo×2
const NAMES = []
for (let i = 1; i <= 20; i++) NAMES.push('Student' + String(i).padStart(2, '0'))
NAMES.push('Amy', 'Amy', 'Amy', 'Leo', 'Leo')

const ALIAS = { Amy: ['王小美', '李爱米', '陈安琪'], Leo: ['刘乐', '赵磊'] }

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
// 北京时间某天某点的 Date：距今 offsetDays 天，北京 bjHour:minute
function bjDateAt(nowMs, offsetDays, bjHour, minute) {
  const bj = new Date(nowMs + offsetDays * DAY + 8 * 3600000)
  return new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate(), bjHour - 8, minute, 0))
}
// 全局稳定的同名序号（分批调用也不错乱）
function aliasFor(globalIdx) {
  const name = NAMES[globalIdx]
  if (!ALIAS[name]) return ''
  let occ = 0
  for (let j = 0; j < globalIdx; j++) if (NAMES[j] === name) occ++
  return ALIAS[name][occ] || ''
}
// 分块并发执行（makers 是一组 () => Promise）
async function runChunked(makers) {
  for (let i = 0; i < makers.length; i += CHUNK) {
    await Promise.all(makers.slice(i, i + CHUNK).map((fn) => fn()))
  }
}

exports.main = async (event = {}) => {
  if (event.confirm !== CONFIRM) {
    return { code: 40001, msg: `未确认：必须传 confirm:'${CONFIRM}'，当前未创建任何数据` }
  }
  const { OPENID } = cloud.getWXContext()
  const ownerId = event.ownerId || OPENID
  if (!ownerId) return { code: 40001, msg: '缺少 ownerId' }

  // 3 秒超时对策：默认每次只造 3 个学员（含其充值+课程），约 40-50 次写，冷启动后也能塞进 3 秒。
  // 不传 to 则自动 = from + 3。整批不够时按 from 递增多调几次。
  const from = Math.max(0, Number(event.from) || 0)
  const to = Math.min(NAMES.length, event.to != null ? Number(event.to) : from + 3)
  const now = Date.now()
  const counts = { students: 0, packages: 0, sessions: 0, completed: 0, creditLogs: 0 }

  // 1) 学员（并发建，拿 id）
  const stuMakers = []
  const created = [] // { id, globalIdx }
  for (let idx = from; idx < to; idx++) {
    const name = NAMES[idx]
    const aliasCn = aliasFor(idx)
    stuMakers.push(() =>
      db
        .collection('students')
        .add({
          data: {
            ownerId,
            name,
            aliasCn,
            levelTag: pick(['KET', 'PET', '启蒙', '']),
            note: '',
            isDeleted: false,
            _seed: true,
            createdAt: db.serverDate()
          }
        })
        .then((r) => created.push({ id: r._id, idx }))
    )
  }
  await runChunked(stuMakers)
  counts.students = created.length

  // 2) 充值 + 课程（并发建）
  const childMakers = []
  for (const { id: studentId } of created) {
    // 充值 2-3 次
    const nPkg = rnd(2, 3)
    for (let p = 0; p < nPkg; p++) {
      const credits = pick([10, 20, 30])
      const at = bjDateAt(now, -rnd(5, 30), rnd(9, 20), 0)
      counts.packages++
      counts.creditLogs++
      childMakers.push(() =>
        db.collection('packages').add({
          data: { ownerId, studentId, totalCredits: credits, purchasedAt: at, note: '现金', _seed: true }
        })
      )
      childMakers.push(() =>
        db.collection('creditLogs').add({
          data: { studentId, sessionId: null, delta: credits, reason: 'purchase', createdAt: at, _seed: true }
        })
      )
    }
    // 8-12 节课
    const nSess = rnd(8, 12)
    for (let s = 0; s < nSess; s++) {
      const c = pick(COURSES)
      const start = bjDateAt(now, rnd(-30, 14), rnd(9, 19), pick([0, 30]))
      const isPast = start.getTime() < now
      counts.sessions++
      childMakers.push(() =>
        db.collection('classSessions').add({
          data: {
            ownerId,
            courseType: c.slug,
            courseTypeId: null,
            courseTypeName: c.name,
            startTime: start,
            durationMin: c.dur,
            status: isPast ? 'completed' : 'scheduled',
            recurrenceId: null,
            studentIds: [studentId],
            attendance: isPast ? { [studentId]: 'present' } : {},
            note: '',
            _seed: true,
            createdAt: db.serverDate()
          }
        })
      )
      if (isPast) {
        counts.completed++
        counts.creditLogs++
        childMakers.push(() =>
          db.collection('creditLogs').add({
            data: { studentId, sessionId: null, delta: -1, reason: 'attend', createdAt: start, _seed: true }
          })
        )
      }
    }
  }
  await runChunked(childMakers)

  console.log(`[seedTestData] range[${from},${to}) ${JSON.stringify(counts)}`)
  return { code: 0, data: { range: [from, to], ...counts } }
}
