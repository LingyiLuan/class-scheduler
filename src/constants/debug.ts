/**
 * 调试开关（仅本地预览用，默认关闭）。要用时手动把 DEBUG_ONBOARDING 改 true、重新编译。
 * ⚠️ 只验证界面，不验证流程：强制渲染引导页看文案/主次视觉，不改任何 users 记录。
 *    完整流程（输码→绑定→进学生端）仍需真实的新微信号。
 *    验证完改回 false 再发任何正式/体验版。
 */
export const DEBUG_ONBOARDING = false

// 预览时点"退出预览"后置 true，让首页不再强制跳引导页（模块级状态，reLaunch 后仍保留）
let _bypass = false
export function setOnboardingBypass(v: boolean): void {
  _bypass = v
}
export function onboardingBypassed(): boolean {
  return _bypass
}
