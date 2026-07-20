/**
 * 云函数统一返回格式。
 * 成功：{ code: 0, data }
 * 失败：{ code: <非0>, msg }
 */
function ok(data = {}) {
  return { code: 0, data }
}

function fail(code, msg) {
  return { code, msg }
}

module.exports = { ok, fail }
