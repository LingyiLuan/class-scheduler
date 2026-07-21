import { View, Text } from '@tarojs/components'
import CourseCard from '../CourseCard'
import { SessionRow } from '../../services/sessions'
import './index.scss'

/**
 * 把一天的课按「时间区间相交」分组。首尾相接不算相交（11:30 结束 vs 11:30 开始 = 两组）。
 * 返回分组数组，每组按开始时间升序。
 */
export function groupOverlaps(courses: SessionRow[]): SessionRow[][] {
  const sorted = [...courses].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
  const groups: SessionRow[][] = []
  let cur: SessionRow[] = []
  let curEnd = -Infinity
  for (const c of sorted) {
    const s = new Date(c.startTime).getTime()
    const e = s + c.durationMin * 60000
    if (cur.length === 0) {
      cur = [c]
      curEnd = e
    } else if (s < curEnd) {
      cur.push(c)
      curEnd = Math.max(curEnd, e)
    } else {
      groups.push(cur)
      cur = [c]
      curEnd = e
    }
  }
  if (cur.length) groups.push(cur)
  return groups
}

/** 单节课直接渲染 CourseCard；重叠多节课包进「叠放纸片」容器 */
export default function CourseGroup({
  courses,
  nameMap,
  onOpen
}: {
  courses: SessionRow[]
  nameMap: Record<string, string>
  onOpen: (id: string) => void
}) {
  if (courses.length <= 1) {
    if (!courses.length) return null
    const c = courses[0]
    return <CourseCard session={c} nameMap={nameMap} onClick={() => onOpen(c._id)} />
  }

  return (
    <View className='cgroup'>
      <View className='cgroup-tag-wrap'>
        <Text className='cav cgroup-tag'>时段冲突 · {courses.length} 节</Text>
      </View>
      <View className='cgroup-body'>
        <View className='cgroup-line' />
        <View className='cgroup-cards'>
          {courses.map((c, i) => (
            <View key={c._id} className={`cgroup-card off${i % 2}`}>
              <CourseCard session={c} nameMap={nameMap} onClick={() => onOpen(c._id)} />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
