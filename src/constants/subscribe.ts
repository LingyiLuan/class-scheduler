/**
 * 订阅消息模板 ID。必须与云函数 cloudfunctions/_shared/subscribe.js 的 TEMPLATES 保持一致
 * （前后端同一份定义；字段 key 只在云端用到，前端仅需 ID 发起授权）。
 */
export const TMPL_CLASS_REMINDER = 'pQI8sXDGRuMoX9T8g8OwUUvZeOpw9nZVqe9bULcl25Q'
export const TMPL_LOW_CREDIT = 'QAHo3VnPf6lKB9UKKCtbHqHC5Sa8dlamf96qbuXLnsc'

/** 首页铃铛一次请求两个模板 */
export const SUBSCRIBE_TMPL_IDS = [TMPL_CLASS_REMINDER, TMPL_LOW_CREDIT]
