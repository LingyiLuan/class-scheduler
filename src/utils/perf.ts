/**
 * 加载性能计时。第 0 步加载诊断用。
 * ⚠️ 诊断开关：Taro build --watch 仍是 production 模式，env 判断不可靠，故用显式常量。
 * 诊断/验证完把 PERF_ON 置 false，或把全部计时插桩整体移除，再发正式/体验版。
 */
export const PERF_ON = true
const ON = PERF_ON

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
