import Taro from '@tarojs/taro'

/**
 * 微信小程序里为什么不用官方 @supabase/supabase-js:
 * realtime-js 依赖全局 WebSocket 构造器、auth-js 依赖 localStorage、
 * 全部 HTTP 走全局 fetch —— 这些在小程序运行时都不存在。
 * 一期也不需要 realtime 订阅与 supabase-auth，因此直接用 Taro.request
 * 封装 PostgREST（Supabase 的 REST 接口）。详见 docs/dev-guide.md 与 README。
 */

const SUPABASE_URL = process.env.TARO_APP_SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.TARO_APP_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // 缺配置时尽早暴露，避免请求发出后才在网络层报错
  console.error('[supabase] 缺少 TARO_APP_SUPABASE_URL / TARO_APP_SUPABASE_ANON_KEY，请检查 .env')
}

const REST_BASE = `${SUPABASE_URL}/rest/v1`

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

export class SupabaseError extends Error {
  statusCode: number
  details: unknown
  constructor(message: string, statusCode: number, details: unknown) {
    super(message)
    this.name = 'SupabaseError'
    this.statusCode = statusCode
    this.details = details
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function send<T>(
  path: string,
  method: HttpMethod,
  options: { data?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const res = await Taro.request({
    url: `${REST_BASE}${path}`,
    method,
    data: options.data as any,
    header: baseHeaders(options.headers)
  })
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as T
  }
  const msg =
    (res.data && (res.data.message || res.data.hint || res.data.error)) ||
    `Supabase 请求失败 (${res.statusCode})`
  throw new SupabaseError(msg, res.statusCode, res.data)
}

type Filters = Record<string, string | number | boolean>

/** 把简单的等值过滤转为 PostgREST 查询串：{id: 1} -> id=eq.1 */
function buildQuery(filters?: Filters, extra?: Record<string, string>): string {
  const parts: string[] = []
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      parts.push(`${encodeURIComponent(k)}=eq.${encodeURIComponent(String(v))}`)
    }
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) parts.push(`${k}=${v}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

/**
 * 极简 PostgREST 查询器。只覆盖一期所需的等值过滤 / 排序 / 限制，
 * 复杂查询按需在各 service 里扩展，不在此处提前抽象。
 */
export function from(table: string) {
  return {
    /** 查询。columns 形如 '*' 或 'id,name'；filters 为等值条件 */
    select<T = unknown>(columns = '*', filters?: Filters, opts?: { order?: string; limit?: number }): Promise<T[]> {
      const extra: Record<string, string> = { select: columns }
      if (opts?.order) extra.order = opts.order
      if (opts?.limit != null) extra.limit = String(opts.limit)
      return send<T[]>(`/${table}${buildQuery(filters, extra)}`, 'GET')
    },
    /** 新增，返回插入后的行 */
    insert<T = unknown>(rows: object | object[]): Promise<T[]> {
      return send<T[]>(`/${table}`, 'POST', {
        data: rows,
        headers: { Prefer: 'return=representation' }
      })
    },
    /** 按等值条件更新，返回更新后的行 */
    update<T = unknown>(patch: object, filters: Filters): Promise<T[]> {
      return send<T[]>(`/${table}${buildQuery(filters)}`, 'PATCH', {
        data: patch,
        headers: { Prefer: 'return=representation' }
      })
    },
    /** 按等值条件删除 */
    remove(filters: Filters): Promise<void> {
      return send<void>(`/${table}${buildQuery(filters)}`, 'DELETE')
    }
  }
}

/** 调用数据库函数，如 rpc('student_balance', { student_id }) */
export function rpc<T = unknown>(fn: string, args?: object): Promise<T> {
  return send<T>(`/rpc/${fn}`, 'POST', { data: args ?? {} })
}

export const supabase = { from, rpc }
export default supabase
