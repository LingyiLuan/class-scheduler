import { useState, useEffect, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { SketchFrame, SketchIcon } from '../../components/sketch'
import TabBar from '../../components/TabBar'
import SheetModal from '../../components/SheetModal'
import NewCourseForm from '../../components/NewCourseForm'
import { PaperToastHost } from '../../components/PaperToast'
import CourseGroup, { groupOverlaps } from '../../components/CourseGroup'
import { listSessions, SessionRow } from '../../services/sessions'
import { listStudents } from '../../services/students'
import { ensureQuota } from '../../services/subscribe'
import { bjDateStr, bjMidnight, bjWeekday } from '../../utils/datetime'
import './index.scss'

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const SK = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-2', 'sk-3', 'sk-1']

interface DayInfo {
  ts: number
  dateStr: string
  wd: string
  dateNum: number
  isToday: boolean
}

function computeWeek(weekOffset: number) {
  const todayStr = bjDateStr(Date.now())
  const todayMid = bjMidnight(todayStr)
  const dow = bjWeekday(todayMid)
  const mondayDelta = dow === 0 ? -6 : 1 - dow
  const mondayMid = todayMid + (mondayDelta + weekOffset * 7) * 86400000
  const days: DayInfo[] = Array.from({ length: 7 }, (_, i) => {
    const ts = mondayMid + i * 86400000
    const dateStr = bjDateStr(ts)
    return { ts, dateStr, wd: WD[bjWeekday(ts)], dateNum: Number(dateStr.slice(8, 10)), isToday: dateStr === todayStr }
  })
  const from = new Date(days[0].ts).toISOString()
  const to = new Date(days[6].ts + 86400000).toISOString()
  const m1 = Number(days[0].dateStr.slice(5, 7))
  const m2 = Number(days[6].dateStr.slice(5, 7))
  const rangeLabel = `${m1}月${days[0].dateNum}日 – ${m2}月${days[6].dateNum}日`
  return { days, from, to, rangeLabel }
}

export default function Schedule() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const { days, from, to, rangeLabel } = useMemo(() => computeWeek(weekOffset), [weekOffset])

  // 从课程详情操作返回后刷新当前周
  useDidShow(() => {
    setRefreshKey((k) => k + 1)
  })

  useEffect(() => {
    listStudents()
      .then(({ list }) => {
        const m: Record<string, string> = {}
        list.forEach((s) => (m[s._id] = s.name))
        setNameMap(m)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    listSessions(from, to, 'workspace')
      .then(({ list }) => setSessions(list))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [from, to, refreshKey])

  const grouped = useMemo(() => {
    return days.map((d) => ({
      ...d,
      courses: sessions
        .filter((s) => bjDateStr(new Date(s.startTime).getTime()) === d.dateStr)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }))
  }, [days, sessions])

  return (
    <View className='sched'>
      <View className='paper-grain' />

      <View className='sched-head'>
        <Text className='sched-title'>课表</Text>
        <View className='week-nav'>
          <Text
            className='nav-btn'
            onClick={() => {
              ensureQuota()
              setWeekOffset((w) => w - 1)
            }}
          >
            ‹
          </Text>
          <Text className='week-range'>{rangeLabel}</Text>
          <Text
            className='nav-btn'
            onClick={() => {
              ensureQuota()
              setWeekOffset((w) => w + 1)
            }}
          >
            ›
          </Text>
          {weekOffset !== 0 ? (
            <Text className='cav week-back' onClick={() => setWeekOffset(0)}>
              today
            </Text>
          ) : null}
        </View>
      </View>

      <View className='sched-inner'>
        {loading ? <Text className='sched-loading'>加载中…</Text> : null}
          {grouped.map((d, i) => (
          <View key={d.dateStr} className={`day-block paper-card ${SK[i]} ${d.isToday ? 'is-today' : ''}`}>
            <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
            <View className='day-head'>
              <Text className='day-wd'>{d.wd}</Text>
              <Text className='day-num'>{d.dateNum}</Text>
              {d.isToday ? <Text className='today-chip cav'>today</Text> : null}
              <Text className='day-count'>{d.courses.length ? `${d.courses.length} 节` : ''}</Text>
            </View>

            {d.courses.length === 0 ? (
              <View className='day-empty'>
                <Text className='cav day-empty-en'>free day</Text>
                <Text className='day-empty-cn'>当天没有课</Text>
              </View>
            ) : (
              groupOverlaps(d.courses).map((g, gi) => (
                <CourseGroup
                  key={gi}
                  courses={g}
                  nameMap={nameMap}
                  onOpen={(cid) => Taro.navigateTo({ url: `/pages/course/detail/index?id=${cid}` })}
                />
              ))
            )}
          </View>
        ))}
      </View>

      <View className='fab' onClick={() => { ensureQuota(); setShowNew(true) }}>
        <SketchIcon name='plus' size={52} color='#FBF3E0' />
      </View>

      <TabBar current='schedule' />

      <SheetModal visible={showNew} onClose={() => setShowNew(false)} title='新建课程'>
        <NewCourseForm
          onCreated={() => {
            setShowNew(false)
            setRefreshKey((k) => k + 1)
          }}
        />
      </SheetModal>

      <PaperToastHost />
    </View>
  )
}
