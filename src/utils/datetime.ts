/**
 * 统一按北京时间（UTC+8）换算，与循环课生成口径一致，避免课程落到错误日期。
 * 云端存的是 UTC 时刻；展示与分组一律转成 +08:00 的日历日/时刻。
 */
const BJ_OFFSET = 8 * 3600 * 1000

/** UTC 毫秒 → 北京日历日 YYYY-MM-DD */
export function bjDateStr(ts: number): string {
  return new Date(ts + BJ_OFFSET).toISOString().slice(0, 10)
}

/** UTC 毫秒 → 北京时刻 HH:mm */
export function bjTimeStr(ts: number): string {
  return new Date(ts + BJ_OFFSET).toISOString().slice(11, 16)
}

/** 北京日历日 YYYY-MM-DD → 该日 00:00(+08:00) 对应的 UTC 毫秒 */
export function bjMidnight(dateStr: string): number {
  return Date.parse(`${dateStr}T00:00:00+08:00`)
}

/** UTC 毫秒 → 北京星期（0=周日 .. 6=周六） */
export function bjWeekday(ts: number): number {
  return new Date(ts + BJ_OFFSET).getUTCDay()
}
