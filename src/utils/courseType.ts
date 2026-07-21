/**
 * 课程类型显示名。优先用 session/recurrence 上的快照 courseTypeName（改名/停用/删类型都不影响历史），
 * 回退旧字符串常量映射，再回退原字符串。
 */
const LEGACY_LABEL: Record<string, string> = { makeup: '补课', cambridge: '剑桥课程' }

export function courseTypeLabel(item: { courseTypeName?: string | null; courseType?: string }): string {
  return item.courseTypeName || LEGACY_LABEL[item.courseType || ''] || item.courseType || '课程'
}
