/**
 * 身份与权限校验。共享模块，由 sync:cloud 复制进各云函数目录后经 require('./_shared/auth') 使用。
 * 依赖调用方的 index.js 已执行 cloud.init()。
 * 错误码约定：401xx 未登录/身份问题，403xx 权限不足。
 */
const cloud = require('wx-server-sdk')

class AuthError extends Error {
  constructor(code, msg) {
    super(msg)
    this.name = 'AuthError'
    this.code = code
  }
}

/** 取当前调用者 openid 与其 users 记录（未建档则 user 为 null） */
async function getContext() {
  const { OPENID } = cloud.getWXContext()
  const db = cloud.database()
  const res = await db.collection('users').where({ openid: OPENID }).limit(1).get()
  return { openid: OPENID, user: res.data[0] || null }
}

/**
 * 校验：已建档 + 已激活 + 角色在允许集合内；不通过抛 AuthError。
 * @param {string|string[]} roles 允许的角色，如 'owner' 或 ['owner','teacher']
 * @returns {Promise<{openid:string, user:object}>}
 */
async function requireRole(roles) {
  const ctx = await getContext()
  if (!ctx.user) throw new AuthError(40101, '用户未登录或未建档')
  if (!ctx.user.isActive) throw new AuthError(40102, '账号未激活，请联系管理员')
  const allow = Array.isArray(roles) ? roles : [roles]
  if (!allow.includes(ctx.user.role)) throw new AuthError(40301, '无操作权限')
  return ctx
}

module.exports = { getContext, requireRole, AuthError }
