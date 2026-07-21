const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
const _ = db.command
const courseTypes = db.collection('courseTypes')
const sessions = db.collection('classSessions')
const recurrences = db.collection('recurrences')

const NAME_MAX = 20
// 首次使用时按 owner 种下的默认类型（slug 与旧字符串常量一致，供历史数据迁移映射）
const SEED = [
  { name: '补课', durationMin: 90, slug: 'makeup' },
  { name: '剑桥课程', durationMin: 120, slug: 'cambridge' }
]

// owner 名下若一条类型都没有，种默认两条（幂等：已有任意类型则跳过）
async function ensureSeed(ownerId) {
  const { total } = await courseTypes.where({ ownerId }).count()
  if (total > 0) return
  const now = db.serverDate()
  for (let i = 0; i < SEED.length; i++) {
    const s = SEED[i]
    await courseTypes.add({
      data: {
        ownerId,
        name: s.name,
        durationMin: s.durationMin,
        creditCost: 1, // 本期固定 1，留字段供二期
        isActive: true,
        sortOrder: i,
        slug: s.slug,
        createdAt: now,
        updatedAt: now
      }
    })
  }
}

async function loadOwned(id, ctx) {
  if (!id) throw new AuthError(40001, '缺少类型 id')
  const res = await courseTypes.where({ _id: id }).get()
  const doc = res.data[0]
  if (!doc) throw new AuthError(40400, '课程类型不存在')
  if (ctx.user.role !== 'owner' && doc.ownerId !== ctx.openid) {
    throw new AuthError(40301, '无权操作该课程类型')
  }
  return doc
}

// 类型是否被任何课程/循环规则引用（用于判断能否硬删）。查 courseTypeId，需为该字段建索引。
async function referenceCount(id) {
  const a = await sessions.where({ courseTypeId: id }).count()
  const b = await recurrences.where({ courseTypeId: id }).count()
  return a.total + b.total
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 列表。activeOnly=true 只返回启用的（建课表单用，停用的完全不出现）
      case 'list': {
        await ensureSeed(ctx.openid)
        const where = { ownerId: ctx.openid }
        if (data.activeOnly) where.isActive = _.neq(false)
        const res = await courseTypes
          .where(where)
          .orderBy('sortOrder', 'asc')
          .orderBy('createdAt', 'asc')
          .limit(100)
          .get()
        return ok({ list: res.data })
      }

      case 'create': {
        const name = String(data.name || '').trim()
        const durationMin = Number(data.durationMin)
        if (!name) return fail(40001, '请填写类型名称')
        if (name.length > NAME_MAX) return fail(40001, `名称不超过 ${NAME_MAX} 字`)
        if (!Number.isInteger(durationMin) || durationMin <= 0) return fail(40001, '默认时长无效')
        const last = await courseTypes
          .where({ ownerId: ctx.openid })
          .orderBy('sortOrder', 'desc')
          .limit(1)
          .get()
        const sortOrder = last.data[0] ? (last.data[0].sortOrder || 0) + 1 : 0
        const now = db.serverDate()
        const doc = {
          ownerId: ctx.openid,
          name,
          durationMin,
          creditCost: 1,
          isActive: true,
          sortOrder,
          slug: null,
          createdAt: now,
          updatedAt: now
        }
        const r = await courseTypes.add({ data: doc })
        return ok({ _id: r._id, ...doc })
      }

      // 改名 / 改默认时长（不含启停、不含 creditCost）。改名不影响历史（历史存的是快照）
      case 'update': {
        const doc = await loadOwned(data.id, ctx)
        const patch = {}
        if (data.name !== undefined) {
          const name = String(data.name).trim()
          if (!name) return fail(40001, '请填写类型名称')
          if (name.length > NAME_MAX) return fail(40001, `名称不超过 ${NAME_MAX} 字`)
          patch.name = name
        }
        if (data.durationMin !== undefined) {
          const d = Number(data.durationMin)
          if (!Number.isInteger(d) || d <= 0) return fail(40001, '默认时长无效')
          patch.durationMin = d
        }
        if (!Object.keys(patch).length) return ok({ _id: doc._id })
        patch.updatedAt = db.serverDate()
        await courseTypes.doc(doc._id).update({ data: patch })
        return ok({ _id: doc._id, ...patch })
      }

      // 启用/停用（软删）。停用后建课不可选，历史正常显示
      case 'setActive': {
        const doc = await loadOwned(data.id, ctx)
        await courseTypes.doc(doc._id).update({
          data: { isActive: data.isActive !== false, updatedAt: db.serverDate() }
        })
        return ok({ _id: doc._id, isActive: data.isActive !== false })
      }

      // 硬删：仅当从未被任何课程/循环规则引用；否则只能停用
      case 'remove': {
        const doc = await loadOwned(data.id, ctx)
        const refs = await referenceCount(doc._id)
        if (refs > 0) {
          return fail(40002, '该类型已被课程使用，无法删除，请改为停用', { refs })
        }
        await courseTypes.doc(doc._id).remove()
        return ok({ _id: doc._id, removed: true })
      }

      // 排序：传有序 id 数组，按下标写回 sortOrder
      case 'reorder': {
        const ids = Array.isArray(data.ids) ? data.ids : []
        if (!ids.length) return fail(40001, '缺少排序列表')
        const mine = await courseTypes.where({ ownerId: ctx.openid }).limit(100).get()
        const ownSet = new Set(mine.data.map((d) => d._id))
        for (const id of ids) if (!ownSet.has(id)) return fail(40301, '存在无权操作的类型')
        const now = db.serverDate()
        for (let i = 0; i < ids.length; i++) {
          await courseTypes.doc(ids[i]).update({ data: { sortOrder: i, updatedAt: now } })
        }
        return ok({ reordered: ids.length })
      }

      // 一次性迁移：种默认类型 + 给存量课程/循环规则回填 courseTypeId + courseTypeName 快照。
      // 幂等：只处理缺 courseTypeId 的旧数据。
      case 'migrate': {
        await ensureSeed(ctx.openid)
        const mine = await courseTypes.where({ ownerId: ctx.openid }).limit(100).get()
        const bySlug = {}
        mine.data.forEach((t) => {
          if (t.slug) bySlug[t.slug] = t
        })
        let sCount = 0
        let rCount = 0
        // 回填 classSessions
        const legacySessions = await sessions
          .where({ ownerId: ctx.openid, courseTypeId: _.exists(false) })
          .limit(1000)
          .get()
        for (const s of legacySessions.data) {
          const t = bySlug[s.courseType]
          if (!t) continue
          await sessions.doc(s._id).update({
            data: { courseTypeId: t._id, courseTypeName: t.name }
          })
          sCount++
        }
        // 回填 recurrences
        const legacyRec = await recurrences
          .where({ ownerId: ctx.openid, courseTypeId: _.exists(false) })
          .limit(1000)
          .get()
        for (const r of legacyRec.data) {
          const t = bySlug[r.courseType]
          if (!t) continue
          await recurrences.doc(r._id).update({
            data: { courseTypeId: t._id, courseTypeName: t.name }
          })
          rCount++
        }
        return ok({ migratedSessions: sCount, migratedRecurrences: rCount, types: mine.data.length })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
