import Taro from '@tarojs/taro'

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
    Taro.showLoading({ title: typeof loading === 'string' ? loading : '加载中', mask: true })
  }

  try {
    if (!Taro.cloud) {
      throw new ApiError(-1, '当前环境不支持云开发')
    }
    const res = await withTimeout(
      Taro.cloud.callFunction({ name, data }) as Promise<Taro.cloud.CallFunctionResult>,
      timeout
    )
    const payload = res.result as ApiResponse<T> | undefined

    if (!payload || typeof payload !== 'object' || typeof (payload as ApiResponse<T>).code !== 'number') {
      throw new ApiError(-1, '云函数返回格式异常')
    }
    if (payload.code !== 0) {
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
      Taro.hideLoading()
    }
  }
}
