/**
 * 云开发环境 ID，直接写死。
 * 不用 process.env：Taro 只在编译期替换「已注入」的 TARO_APP_ 变量；未注入时 process.env.xxx
 * 会原样留在产物里，而小程序运行时没有 process 全局对象，会导致 app.js 崩溃、页面白屏。
 * 环境 ID 非敏感信息（private repo）。后续如需按环境切换，再在 .env.[mode] 配 TARO_APP_CLOUD_ENV
 * 并配合 Taro env 注入改回读取。
 */
export const CLOUD_ENV = 'cloud1-d2gewe4s5855abc8e'
