/**
 * ⚠️ 临时诊断函数——排查批量余额 vs 逐个余额不一致。用完即删（diagBalances）。只读，不改数据。
 *
 * 对同一批 studentIds：
 *   single[id] = 旧逐个：aggregate.match({studentId:id}).group(sum delta)
 *   batch[id]  = 新批量：aggregate.match({studentId in ids}).group(_id:studentId, sum delta)
 * diff 出对不上的，并给根因信号：
 *   - missingFromStudents：students 查询没返回的 id（→ students.get 限制/归属过滤/孤儿 id）
 *   - inGroups：该 id 在批量聚合分组结果里有没有出现（→ 聚合截断/类型不匹配）
 *   - groupCount vs total：聚合返回的分组数是否少于请求数（→ 聚合默认条数上限截断）
 *   - sample：对不上的那个学员，抽 3 条流水看 studentId/delta 的类型与值
 *
 * 调用（云端测试）：不传 studentIds 则取 ownerId 名下全部学员：
 *   { "ownerId":"<你的openid>" }
 * 或指定：{ "studentIds":["id1","id2",...] }
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

async function singleBalance(id) {
  const r = await db
    .collection('creditLogs')
    .aggregate()
    .match({ studentId: id })
    .group({ _id: null, total: $.sum('$delta') })
    .end()
  return r.list && r.list[0] ? r.list[0].total : 0
}

exports.main = async (event = {}) => {
  let studentIds = Array.isArray(event.studentIds) ? event.studentIds.filter(Boolean) : []
  const ownerId = event.ownerId

  // 未传 id 则取 ownerId（或全部）名下学员，模拟真实首页/学员页的入参
  if (!studentIds.length) {
    const where = { isDeleted: _.neq(true) }
    if (ownerId) where.ownerId = ownerId
    const sr = await db.collection('students').where(where).limit(200).get()
    studentIds = sr.data.map((s) => s._id)
  }

  // 复刻 balances 的 students 查询（看谁没被返回）
  const sres = await db.collection('students').where({ _id: _.in(studentIds) }).get()
  const foundIds = sres.data.map((s) => s._id)
  const missingFromStudents = studentIds.filter((id) => foundIds.indexOf(id) === -1)

  // 批量聚合
  const agg = await db
    .collection('creditLogs')
    .aggregate()
    .match({ studentId: _.in(studentIds) })
    .group({ _id: '$studentId', total: $.sum('$delta') })
    .limit(studentIds.length) // 与 credits.balances 修法一致，避免默认 20 组截断
    .end()
  const batch = {}
  studentIds.forEach((id) => (batch[id] = 0))
  const groupIds = new Set()
  agg.list.forEach((r) => {
    batch[r._id] = r.total
    groupIds.add(r._id)
  })

  // 逐个
  const single = {}
  for (const id of studentIds) single[id] = await singleBalance(id)

  // diff
  const diffs = []
  for (const id of studentIds) {
    if (single[id] !== batch[id]) {
      diffs.push({
        id,
        single: single[id],
        batch: batch[id],
        inGroups: groupIds.has(id),
        inStudents: foundIds.indexOf(id) !== -1
      })
    }
  }

  // 抽样对不上学员的流水类型
  let sample = null
  if (diffs.length) {
    const bad = diffs[0].id
    const logs = await db.collection('creditLogs').where({ studentId: bad }).limit(3).get()
    sample = {
      id: bad,
      idType: typeof bad,
      logCount: logs.data.length,
      logs: logs.data.map((l) => ({
        studentId: l.studentId,
        studentIdType: typeof l.studentId,
        idEqual: l.studentId === bad,
        delta: l.delta,
        deltaType: typeof l.delta
      }))
    }
  }

  return {
    code: 0,
    data: {
      total: studentIds.length,
      studentsGetCount: sres.data.length,
      groupCount: agg.list.length,
      diffCount: diffs.length,
      missingFromStudents,
      diffs,
      sample
    }
  }
}
