import { View, Text } from '@tarojs/components'
import { StatusMark } from '../sketch'
import { SessionRow } from '../../services/sessions'
import { SessionStatus } from '../../constants'
import { bjTimeStr } from '../../utils/datetime'
import './index.scss'

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  completed: '已完成',
  absent: '缺勤',
  cancelled: '已取消'
}
const COURSE_LABEL: Record<string, string> = { makeup: '补课', cambridge: '剑桥课程' }

/** 课程卡片（周视图与首页今日课程共用） */
export default function CourseCard({
  session,
  nameMap,
  onClick
}: {
  session: SessionRow
  nameMap: Record<string, string>
  onClick: () => void
}) {
  const c = session
  const startTs = new Date(c.startTime).getTime()
  const endTs = startTs + c.durationMin * 60000
  const cnt = c.studentIds.length
  const isCancelled = c.status === SessionStatus.Cancelled
  const names = c.studentIds.map((id) => nameMap[id] || '学员已删除').join('、')
  const avatar = nameMap[c.studentIds[0]] ? nameMap[c.studentIds[0]].slice(0, 1) : '–'

  return (
    <View className={`course-card ${isCancelled ? 'cc-off' : ''}`} onClick={onClick}>
      <View className='cc-top'>
        <Text className='cc-time'>
          {bjTimeStr(startTs)}–{bjTimeStr(endTs)}
        </Text>
        <Text className='cc-dur'>{c.durationMin}分</Text>
        <View className='cc-status'>
          <StatusMark status={c.status as SessionStatus} size={30} />
          <Text className='cc-status-label' style={{ color: `var(--status-${c.status})` }}>
            {STATUS_LABEL[c.status] || c.status}
          </Text>
        </View>
      </View>
      <View className='cc-bottom'>
        <View className='cc-avatar'>{avatar}</View>
        <View className='cc-info'>
          <Text className='cc-names'>{names}</Text>
          <Text className='cc-meta'>
            {COURSE_LABEL[c.courseType] || c.courseType} · {cnt > 1 ? `${cnt}人小班` : '一对一'}
          </Text>
        </View>
      </View>
    </View>
  )
}
