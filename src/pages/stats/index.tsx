import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { SketchFrame } from '../../components/sketch'
import SheetModal from '../../components/SheetModal'
import CourseCard from '../../components/CourseCard'
import { listSessionsRange, SessionRow } from '../../services/sessions'
import { listStudents } from '../../services/students'
import { bjDateStr, bjMidnight, bjWeekday } from '../../utils/datetime'
import './index.scss'

const WEEKS = 26
const DAY = 86400000
const DAY_LABELS = ['周一', '', '周三', '', '周五', '', '']

interface DayInfo {
  consumed: number
  sessions: SessionRow[]
}

function presentCount(s: SessionRow): number {
  const att = s.attendance || {}
  const keys = Object.keys(att)
  if (keys.length) return keys.filter((k) => att[k] === 'present').length
  return s.studentIds.length
}

function level(consumed: number): number {
  if (consumed === 0) return 0
  if (consumed <= 2) return 1
  if (consumed <= 4) return 2
  return 3
}

export default function Stats() {
  const [dayMap, setDayMap] = useState<Record<string, DayInfo>>({})
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [monthConsumed, setMonthConsumed] = useState(0)
  const [monthCompleted, setMonthCompleted] = useState(0)
  const [halfConsumed, setHalfConsumed] = useState(0)
  const [selected, setSelected] = useState<string>('')
  const [showDay, setShowDay] = useState(false)
  const [loadErr, setLoadErr] = useState(false)
  const [scrollLeft, setScrollLeft] = useState(0)

  useLoad(() => {
    load()
  })

  async function load() {
    try {
      const todayMid = bjMidnight(bjDateStr(Date.now()))
      const dow = bjWeekday(todayMid)
      const thisMonday = todayMid + (dow === 0 ? -6 : 1 - dow) * DAY
      const startMonday = thisMonday - (WEEKS - 1) * 7 * DAY
      const from = new Date(startMonday).toISOString()
      const to = new Date(thisMonday + 7 * DAY).toISOString()

      const { list } = await listSessionsRange(from, to)
      const stu = await listStudents()
      const nm: Record<string, string> = {}
      stu.list.forEach((s) => (nm[s._id] = s.name))
      setNameMap(nm)

      const map: Record<string, DayInfo> = {}
      const curMonth = bjDateStr(Date.now()).slice(0, 7)
      let mC = 0
      let mDone = 0
      let hC = 0
      list.forEach((s) => {
        const d = bjDateStr(new Date(s.startTime).getTime())
        if (!map[d]) map[d] = { consumed: 0, sessions: [] }
        map[d].sessions.push(s)
        if (s.status === 'completed') {
          const pc = presentCount(s)
          map[d].consumed += pc
          hC += pc
          if (d.slice(0, 7) === curMonth) {
            mC += pc
            mDone += 1
          }
        }
      })
      setDayMap(map)
      setMonthConsumed(mC)
      setMonthCompleted(mDone)
      setHalfConsumed(hC)
      setLoadErr(false)
      // 默认滚到最右（最近的周）
      setTimeout(() => setScrollLeft(99999), 80)
    } catch (e) {
      console.log('[stats] 加载失败', e)
      setLoadErr(true)
    }
  }

  function openDay(dateStr: string) {
    setSelected(dateStr)
    setShowDay(true)
  }

  // 构建 26 周 × 7 天
  const todayStr = bjDateStr(Date.now())
  const todayMid = bjMidnight(todayStr)
  const dow = bjWeekday(todayMid)
  const thisMonday = todayMid + (dow === 0 ? -6 : 1 - dow) * DAY
  const startMonday = thisMonday - (WEEKS - 1) * 7 * DAY
  const weeks = Array.from({ length: WEEKS }, (_w, w) =>
    Array.from({ length: 7 }, (_d, d) => {
      const ts = startMonday + (w * 7 + d) * DAY
      const dateStr = bjDateStr(ts)
      return { ts, dateStr, isToday: dateStr === todayStr }
    })
  )

  const daySessions = selected
    ? (dayMap[selected]?.sessions || [])
        .slice()
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    : []
  const dayConsumed = selected ? dayMap[selected]?.consumed || 0 : 0
  const selLabel = selected ? `${Number(selected.slice(5, 7))}月${Number(selected.slice(8, 10))}日` : ''

  return (
    <View className='stats'>
      <View className='paper-grain' />
      <View className='stats-inner'>
        <Text className='cav stats-eyebrow'>statistics</Text>
        <Text className='stats-title'>消耗统计</Text>

        {loadErr ? (
          <View className='stats-err' onClick={load}>
            <Text className='stats-err-txt'>加载失败，点此重试</Text>
          </View>
        ) : null}

        {/* 汇总 */}
        <View className='sum-card paper-card sk-2'>
          <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
          <View className='sum-row'>
            <View className='sum-item'>
              <Text className='cav sum-en'>this month</Text>
              <Text className='sum-num'>{monthConsumed}</Text>
              <Text className='sum-label'>本月消耗课时</Text>
            </View>
            <View className='sum-div' />
            <View className='sum-item'>
              <Text className='cav sum-en'>done</Text>
              <Text className='sum-num'>{monthCompleted}</Text>
              <Text className='sum-label'>本月完成课程</Text>
            </View>
            <View className='sum-div' />
            <View className='sum-item'>
              <Text className='cav sum-en'>6 months</Text>
              <Text className='sum-num'>{halfConsumed}</Text>
              <Text className='sum-label'>近半年总消耗</Text>
            </View>
          </View>
        </View>

        {/* 热力日历 */}
        <View className='heat-headline'>
          <Text className='cav heat-en'>last 6 months</Text>
          <Text className='heat-title'>每日消耗课时</Text>
        </View>
        <View className='heat'>
          <View className='heat-left'>
            <View className='heat-month-spacer' />
            {DAY_LABELS.map((l, i) => (
              <View key={i} className='heat-daylabel'>
                {l}
              </View>
            ))}
          </View>
          <ScrollView scrollX scrollLeft={scrollLeft} scrollWithAnimation className='heat-scroll'>
            <View className='heat-body'>
              <View className='heat-months'>
                {weeks.map((wk, wi) => {
                  const m = wk[0].dateStr.slice(5, 7)
                  const prevM = wi > 0 ? weeks[wi - 1][0].dateStr.slice(5, 7) : ''
                  return (
                    <View key={wi} className='heat-month'>
                      {m !== prevM ? `${Number(m)}月` : ''}
                    </View>
                  )
                })}
              </View>
              <View className='heat-grid'>
                {weeks.map((wk, wi) => (
                  <View key={wi} className='heat-col'>
                    {wk.map((day, di) => {
                      const consumed = dayMap[day.dateStr]?.consumed || 0
                      return (
                        <View
                          key={di}
                          className={`heat-cell l${level(consumed)} r${(wi + di) % 3} ${day.isToday ? 'today' : ''}`}
                          onClick={() => openDay(day.dateStr)}
                        />
                      )
                    })}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>

        {/* 图例 */}
        <View className='heat-legend'>
          <Text className='legend-txt'>少</Text>
          <View className='legend-cell l0' />
          <View className='legend-cell l1' />
          <View className='legend-cell l2' />
          <View className='legend-cell l3' />
          <Text className='legend-txt'>多</Text>
        </View>
      </View>

      <SheetModal visible={showDay} onClose={() => setShowDay(false)} title={selLabel}>
        <View className='day-detail'>
          <Text className='day-consumed'>当天消耗 {dayConsumed} 课时</Text>
          {daySessions.length === 0 ? (
            <Text className='day-empty'>当天没有课</Text>
          ) : (
            daySessions.map((s) => (
              <CourseCard
                key={s._id}
                session={s}
                nameMap={nameMap}
                onClick={() => {
                  setShowDay(false)
                  Taro.navigateTo({ url: `/pages/course/detail/index?id=${s._id}` })
                }}
              />
            ))
          )}
        </View>
      </SheetModal>
    </View>
  )
}
