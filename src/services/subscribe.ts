import Taro from '@tarojs/taro'
import { SUBSCRIBE_TMPL_IDS } from '../constants/subscribe'

/**
 * 订阅消息额度管理。
 *
 * 背景（已验证）：一次性订阅额度可无限累积——用户订阅几次，服务端就能发几次；勾「总是保持以上选择」
 * 后不再弹窗，可静默累积。唯一限制：requestSubscribeMessage 必须在用户点击手势的同步回调内调用。
 *
 * 策略：把 requestSubscribeMessage 挂到老师所有高频 tap 点静默补额。为不打断未勾选用户（会反复弹窗），
 * 只对「已勾总是保持」的模板请求。是否已勾用 getSetting(withSubscriptions) 判断，结果缓存；
 * 手势内同步用缓存发起请求（避免 await getSetting 造成手势丢失），调用后异步刷新缓存供下次。
 */

// 已「结算」（出现在 itemSettings，即用户已勾「总是保持」）的模板 —— 对其静默请求不会弹窗
let settledIds: string[] = []

interface SubSetting {
  mainSwitch?: boolean
  itemSettings?: Record<string, string>
}

/** 后台读取订阅设置刷新缓存（非手势内，仅 getSetting，不发起请求） */
export async function refreshQuotaSetting(): Promise<void> {
  try {
    if (!Taro.getSetting) return
    const res = await Taro.getSetting({ withSubscriptions: true })
    const sub = (res as { subscriptionsSetting?: SubSetting }).subscriptionsSetting
    if (!sub || sub.mainSwitch === false) {
      settledIds = []
      return
    }
    const items = sub.itemSettings || {}
    settledIds = SUBSCRIBE_TMPL_IDS.filter((id) => items[id] !== undefined)
  } catch {
    // 保留旧缓存
  }
}

/** 是否已勾「总是保持」（读缓存，供铃铛引导判断；页面加载时先调 refreshQuotaSetting 预热） */
export function quotaSettled(): boolean {
  return settledIds.length > 0
}

/**
 * 静默补额：必须在用户点击手势的同步回调内调用。
 * 用缓存的「已总是保持」模板同步发起请求（不弹窗、额度无限累积）；未勾的不请求，避免反复弹窗。
 * 顺带异步刷新缓存。失败静默，绝不打断用户操作。
 */
export function ensureQuota(): void {
  try {
    if (Taro.requestSubscribeMessage && settledIds.length) {
      Taro.requestSubscribeMessage({ tmplIds: settledIds }).catch(() => {})
    }
  } catch {
    // 静默
  }
  refreshQuotaSetting()
}

/**
 * 显式请求授权（铃铛主入口、或引导弹窗 confirm 内调用）。
 * 必须在 tap 手势内同步调用（本函数开头即发起，勿在调用前 await）。已勾静默累积；未勾则弹窗。
 */
export async function requestSubscribe(tmplIds: string[] = SUBSCRIBE_TMPL_IDS): Promise<void> {
  try {
    if (!tmplIds.length || !Taro.requestSubscribeMessage) return
    await Taro.requestSubscribeMessage({ tmplIds })
  } catch {
    // 用户拒绝 / 不支持
  } finally {
    refreshQuotaSetting()
  }
}
