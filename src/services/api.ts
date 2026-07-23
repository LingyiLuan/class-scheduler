import Taro from '@tarojs/taro'
import { STORAGE_LOGIN } from '../constants'
import { PERF_ON } from '../utils/perf'

// 当前小程序运行版本（develop/trial/release），随每次云函数调用带上，
// 供云端决定订阅消息的 miniprogramState（体验版必须传 trial 才收得到）。取一次缓存。
let ENV_VERSION = ''
try {
  ENV_VERSION = (Taro.getAccountInfoSync && Taro.getAccountInfoSync().miniProgram.envVersion) || ''
} catch {
  // ignore
}

// 加载诊断（第 0 步）：记录每次云调用往返耗时，并标记每个函数的首次调用（冷启动）。
// 用 perf 的显式开关（Taro build --watch 仍是 production，env 判断不可靠）。诊断完随插桩一起移除。
const TIMING = PERF_ON
const seenFns = new Set<string>()

// 401xx（未登录/未建档/未激活）与 403xx(无权限)视为登录态失效
function isAuthError(code: number): boolean {
  return (code >= 40100 && code < 40200) || (code >= 40300 && code < 40400)
}

let redirecting = false

// 服务端拒绝（每次调用都会实时校验）时，清本地登录缓存并跳转待激活页
function handleAuthReject(): void {
  try {
    Taro.removeStorageSync(STORAGE_LOGIN)
  } catch {
    // ignore
  }
  const pages = (Taro.getCurrentPages && Taro.getCurrentPages()) || []
  const top = pages[pages.length - 1]
  const route = top && (top as { route?: string }).route
  if (route === 'pages/pending/index' || redirecting) return
  redirecting = true
  Taro.redirectTo({ url: '/pages/pending/index' }).catch(() => {}).then(() => {
    redirecting = false
  })
}

/**
 * 云函数调用统一封装。
 * 小程序端不直接读写云数据库，一律经此发起 wx.cloud.callFunction。
 * 云函数返回约定：成功 { code: 0, data }，失败 { code: <非0>, msg }。
 * 页面不直接调 api，一律通过 services/ 下各业务模块间接调用。
 */

export interface ApiOk<T> {
  code: 0
  data: T
}
export interface ApiFail {
  code: number
  msg: string
}
export type ApiResponse<T> = ApiOk<T> | ApiFail

export class ApiError extends Error {
  code: number
  data?: unknown
  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.data = data
  }
}

export interface CallOptions {
  /** 是否显示全屏 loading，传字符串可自定义文案 */
  loading?: boolean | string
  /** 超时毫秒，默认 15s */
  timeout?: number
  /** 出错时不自动 toast（由调用方自行处理） */
  silent?: boolean
}

// showLoading 与 hideLoading 必须配对。并发调用用引用计数：仅首个显示、末个隐藏，
// 避免「showLoading 应与 hideLoading 配对使用」的重复告警（多个带 loading 的请求同时在飞时）。
let loadingCount = 0
function showLoadingRC(title: string): void {
  if (loadingCount === 0) Taro.showLoading({ title, mask: true })
  loadingCount += 1
}
function hideLoadingRC(): void {
  if (loadingCount === 0) return
  loadingCount -= 1
  if (loadingCount === 0) Taro.hideLoading()
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiError(-2, '请求超时，请重试')), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

/**
 * 调用云函数并解包返回。成功返回 data；失败抛 ApiError（默认已 toast）。
 * @param name 云函数名（对应 cloudfunctions/<name>）
 * @param data 入参
 */
export async function callFunction<T = unknown>(
  name: string,
  data?: Record<string, unknown>,
  options: CallOptions = {}
): Promise<T> {
  const { loading = false, timeout = 15000, silent = false } = options

  if (loading) {
    showLoadingRC(typeof loading === 'string' ? loading : '加载中')
  }

  try {
    if (!Taro.cloud) {
      throw new ApiError(-1, '当前环境不支持云开发')
    }
    const _t0 = TIMING ? Date.now() : 0
    const _cold = TIMING && !seenFns.has(name)
    const action = data && typeof data.action === 'string' ? data.action : ''
    const res = await withTimeout(
      Taro.cloud.callFunction({
        name,
        data: { ...(data || {}), envVersion: ENV_VERSION }
      }) as Promise<Taro.cloud.CallFunctionResult>,
      timeout
    )
    if (TIMING) {
      seenFns.add(name)
      // eslint-disable-next-line no-console
      console.log(`[timing] cf ${name}${action ? '.' + action : ''} ${Date.now() - _t0}ms${_cold ? ' (cold)' : ''}`)
    }
    const payload = res.result as ApiResponse<T> | undefined

    if (!payload || typeof payload !== 'object' || typeof (payload as ApiResponse<T>).code !== 'number') {
      throw new ApiError(-1, '云函数返回格式异常')
    }
    if (payload.code !== 0) {
      if (isAuthError(payload.code)) handleAuthReject()
      throw new ApiError(
        payload.code,
        (payload as ApiFail).msg || '操作失败',
        (payload as { data?: unknown }).data
      )
    }
    return (payload as ApiOk<T>).data
  } catch (e) {
    const err =
      e instanceof ApiError
        ? e
        : new ApiError(-1, (e as { errMsg?: string })?.errMsg || '网络异常，请重试')
    if (!silent) {
      Taro.showToast({ title: err.message, icon: 'none' })
    }
    throw err
  } finally {
    if (loading) {
      hideLoadingRC()
    }
  }
}
