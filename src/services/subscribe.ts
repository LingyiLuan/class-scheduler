import Taro from '@tarojs/taro'

/**
 * 请求订阅消息授权。
 * 微信要求必须在用户点击手势中调用（如提交/铃铛点击），否则报 fail can only be invoked by user TAP。
 * 因此调用点都放在 tap 处理函数早段。用户拒绝 / 环境不支持一律静默——授权是锦上添花，不打断主流程。
 * 一次性订阅：每次授权仅够发 1 条，靠首页铃铛 + 建课 + 充值多个时机累积额度。
 */
export async function requestSubscribe(tmplIds: string[]): Promise<void> {
  try {
    if (!tmplIds.length || !Taro.requestSubscribeMessage) return
    await Taro.requestSubscribeMessage({ tmplIds })
  } catch {
    // 忽略：用户拒绝 / 不支持
  }
}
