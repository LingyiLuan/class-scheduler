const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { ok, fail } = require('./_shared/resp')

const db = cloud.database()

/**
 * 登录：拿 openid，查/建 users 记录，返回 { role, isActive, boundStudentIds, displayName }。
 * login 是身份入口，用户可能尚未建档，故不经 requireRole。
 * action='setDisplayName'：设置自己的显示名（欢迎语用）。
 */
exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return fail(40100, '无法获取 openid')

  try {
    // 设置自己的显示名
    if (event.action === 'setDisplayName') {
      const name = String((event.data && event.data.name) || '').trim()
      if (!name) return fail(40001, '请填写名字')
      if (name.length > 20) return fail(40001, '名字不超过 20 字')
      const r = await db.collection('users').where({ openid: OPENID }).limit(1).get()
      if (!r.data[0]) return fail(40101, '用户未建档')
      await db.collection('users').doc(r.data[0]._id).update({ data: { displayName: name } })
      return ok({ displayName: name })
    }

    const found = await db.collection('users').where({ openid: OPENID }).limit(1).get()
    let user = found.data[0]

    if (!user) {
      // 首个登录用户设为 owner 并激活；其余默认 teacher、待 owner 激活。
      // 注意：count + add 非原子，并发首次登录理论上可能产生多个 owner；
      // 一期单老师可接受，二期如需严格可用一个固定标识文档加锁。
      const { total } = await db.collection('users').count()
      const isFirst = total === 0
      const data = {
        openid: OPENID,
        nickname: '',
        avatarUrl: '',
        displayName: '',
        role: isFirst ? 'owner' : 'teacher',
        isActive: isFirst,
        boundStudentIds: [],
        createdAt: db.serverDate()
      }
      const added = await db.collection('users').add({ data })
      user = { _id: added._id, ...data }
    }

    return ok({
      role: user.role,
      isActive: user.isActive,
      boundStudentIds: user.boundStudentIds || [],
      displayName: user.displayName || ''
    })
  } catch (e) {
    return fail(50000, e.message || '登录失败')
  }
}
