import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useRouter, useLoad } from '@tarojs/taro'
import { getChildSessions, ChildSession } from '../../../services/parent'
import { SessionStatus } from '../../../constants'
import { StatusMark } from '../../../components/sketch'
import { bjDateStr, bjTimeStr } from '../../../utils/datetime'
import { courseTypeLabel } from '../../../utils/courseType'
import './index.scss'

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  completed: '已完成',
  absent: '缺勤',
  cancelled: '已取消'
}

function Row({ s }: { s: ChildSession }) {
  const ts = new Date(s.startTime).getTime()
  return (
    <View className='pc-rec'>
      <StatusMark status={s.status as SessionStatus} size={34} />
      <Text className='pc-rec-title'>
        {bjDateStr(ts).slice(5)} {bjTimeStr(ts)} · {courseTypeLabel(s)}
      </Text>
      <Text className='pc-rec-status' style={{ color: `var(--status-${s.status})` }}>
        {STATUS_LABEL[s.status] || s.status}
      </Text>
    </View>
  )
}

export default function ParentChild() {
  const router = useRouter()
  const id = router.params.id as string
  const [name, setName] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [list, setList] = useState<ChildSession[]>([])
  const [loaded, setLoaded] = useState(false)

  useLoad(() => {
    if (id) load()
  })

  async function load() {
    try {
      const r = await getChildSessions(id)
      setName(r.name)
      setBalance(r.balance)
      setList(r.list)
    } catch {
      // toasted
    } finally {
      setLoaded(true)
    }
  }

  const now = Date.now()
  const isUpcoming = (s: ChildSession) =>
    new Date(s.startTime).getTime() >= now && s.status === SessionStatus.Scheduled
  const upcoming = list
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  const past = list.filter((s) => !isUpcoming(s))
  const low = balance != null && balance <= 2

  return (
    <View className='pc'>
      <View className='paper-grain' />

      <View className='pc-head'>
        <Text className='pc-title'>{name || '孩子'}</Text>
        {balance != null ? (
          <Text className={`pc-bal ${low ? 'low' : ''}`}>
            {low ? '课时不足，请联系老师续费' : `剩余 ${balance} 课时`}
          </Text>
        ) : null}
      </View>

      <Text className='pc-section'>即将上课</Text>
      {loaded && upcoming.length === 0 ? (
        <Text className='pc-empty'>近期没有排课</Text>
      ) : (
        upcoming.map((s) => <Row key={s._id} s={s} />)
      )}

      <Text className='pc-section'>上课记录</Text>
      {loaded && past.length === 0 ? (
        <Text className='pc-empty'>还没有上课记录</Text>
      ) : (
        past.map((s) => <Row key={s._id} s={s} />)
      )}
    </View>
  )
}
