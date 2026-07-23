/**
 * 加载性能计时（仅开发环境输出，正式包为空操作，不污染）。
 * 第 0 步加载诊断用，诊断完可整体移除。
 */
const ON = process.env.NODE_ENV === 'development'

export interface Perf {
  lap(label: string): void
  end(): void
}

const NOOP: Perf = { lap() {}, end() {} }

/** 开始一段计时；lap(label) 记录到上一个 lap 的间隔，end() 打印总耗时与各段 */
export function perfStart(tag: string): Perf {
  if (!ON) return NOOP
  const t0 = Date.now()
  let last = t0
  const parts: string[] = []
  return {
    lap(label: string) {
      const n = Date.now()
      parts.push(`${label}:${n - last}ms`)
      last = n
    },
    end() {
      // eslint-disable-next-line no-console
      console.log(`[perf] ${tag} total:${Date.now() - t0}ms | ${parts.join('  ')}`)
    }
  }
}
