const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { requireRole, AuthError } = require('./_shared/auth')
const { ok, fail } = require('./_shared/resp')

const db = cloud.database()
const col = db.collection('workspaceConfig')

// 工作室级配置（当前单工作室，单文档）。二期加 workspaceId 后按其分文档。
const DEFAULT_GREETING = '欢迎 Ruby & Yumi 老师'

async function getDoc() {
  const r = await col.where({ scope: 'workspace' }).limit(1).get()
  return r.data[0] || null
}

exports.main = async (event = {}) => {
  try {
    const ctx = await requireRole(['owner', 'teacher'])
    const { action, data = {} } = event

    switch (action) {
      // 读工作室配置（所有登录者，主页欢迎语用）
      case 'get': {
        const doc = await getDoc()
        return ok({ greeting: (doc && doc.greeting) || DEFAULT_GREETING })
      }

      // 改欢迎语，仅 owner
      case 'setGreeting': {
        if (ctx.user.role !== 'owner') return fail(40301, '仅管理员可修改')
        const greeting = String(data.greeting || '').trim()
        if (!greeting) return fail(40001, '欢迎语不能为空')
        if (greeting.length > 30) return fail(40001, '欢迎语不超过 30 字')
        const doc = await getDoc()
        if (doc) await col.doc(doc._id).update({ data: { greeting } })
        else await col.add({ data: { scope: 'workspace', greeting, createdAt: db.serverDate() } })
        return ok({ greeting })
      }

      default:
        return fail(40000, `未知操作：${action}`)
    }
  } catch (e) {
    if (e instanceof AuthError) return fail(e.code, e.message)
    return fail(50000, e.message || '服务异常')
  }
}
