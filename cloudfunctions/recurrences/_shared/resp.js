/**
 * 云函数统一返回格式。
 * 成功：{ code: 0, data }
 * 失败：{ code: <非0>, msg }，可选带 data（如冲突检测返回 { conflicts }）
 */
function ok(data = {}) {
  return { code: 0, data }
}

function fail(code, msg, data) {
  const r = { code, msg }
  if (data !== undefined) r.data = data
  return r
}

module.exports = { ok, fail }
