/**
 * 云开发环境 ID。
 * 开通云开发后（微信开发者工具 → 云开发 → 开通 → 免费套餐），把环境 ID 填到 .env 的
 * TARO_APP_CLOUD_ENV，或直接改这里的兜底值。未正确配置时 wx.cloud.init 会失败。
 */
export const CLOUD_ENV = process.env.TARO_APP_CLOUD_ENV || 'REPLACE_WITH_CLOUD_ENV_ID'
