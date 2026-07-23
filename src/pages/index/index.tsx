import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ensureLogin, canAccessApp } from '../../services/user'
import { getGreeting } from '../../services/config'
import { UserRole } from '../../constants'
import { SketchFrame, SketchIcon, StatusMark } from '../../components/sketch'
import TabBar from '../../components/TabBar'
import SheetModal from '../../components/SheetModal'
import RechargeForm from '../../components/RechargeForm'
import { PaperToastHost } from '../../components/PaperToast'
import CourseCard from '../../components/CourseCard'
import { listSessions, SessionRow } from '../../services/sessions'
import { listStudents, getBalances } from '../../services/students'
import { refreshQuotaSetting } from '../../services/subscribe'
import { unreadCount } from '../../services/notifications'
import { bjDateStr, bjMidnight, bjWeekday } from '../../utils/datetime'
import { perfStart } from '../../utils/perf'
import './index.scss'

interface Quick {
  key: string
  label: string
  icon: string
  sk: string
  onTap: () => void
}

interface LowStu {
  _id: string
  name: string
  levelTag?: string
  balance: number
}

function presentCount(s: SessionRow): number {
  const att = s.attendance || {}
  const keys = Object.keys(att)
  if (keys.length) return keys.filter((k) => att[k] === 'present').length
  return s.studentIds.length
}

export default function Index() {
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('')
  const [wsGreeting, setWsGreeting] = useState('')
  const [showRecharge, setShowRecharge] = useState(false)
  const [weekSessions, setWeekSessions] = useState<SessionRow[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [lowStudents, setLowStudents] = useState<LowStu[]>([])
  const [unread, setUnread] = useState(0)

  useDidShow(() => {
    route()
  })

  async function route() {
    setLoading(true)
    try {
      const info = await ensureLogin()
      if (canAccessApp(info)) {
        setRole(info.role)
        setLoading(false)
        refreshQuotaSetting() // 预热订阅设置缓存，供铃铛引导判断
        getGreeting()
          .then((g) => setWsGreeting(g.greeting))
          .catch(() => {})
        loadData()
      } else {
        Taro.redirectTo({ url: '/pages/pending/index' })
      }
    } catch {
      setLoading(false)
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  }

  async function loadData() {
    const p = perfStart('home.loadData')
    try {
      const now = Date.now()
      const todayMid = bjMidnight(bjDateStr(now))
      const dow = bjWeekday(todayMid)
      const mondayMid = todayMid + (dow === 0 ? -6 : 1 - dow) * 86400000
      const from = new Date(mondayMid).toISOString()
      const to = new Date(mondayMid + 7 * 86400000).toISOString()
      const sess = await listSessions(from, to)
      p.lap('listSessions')
      setWeekSessions(sess.list)

      const stu = await listStudents()
      p.lap(`listStudents(${stu.list.length})`)
      const nm: Record<string, string> = {}
      stu.list.forEach((s) => (nm[s._id] = s.name))
      setNameMap(nm)
      let low: LowStu[] = []
      try {
        const { balances } = await getBalances(stu.list.map((s) => s._id))
        low = stu.list
          .filter((s) => (balances[s._id] ?? 0) <= 2)
          .map((s) => ({ _id: s._id, name: s.name, levelTag: s.levelTag, balance: balances[s._id] ?? 0 }))
      } catch {
        // ignore
      }
      p.lap(`balances(${stu.list.length})`)
      low.sort((a, b) => a.balance - b.balance)
      setLowStudents(low)
      try {
        const u = await unreadCount()
        setUnread(u.count)
      } catch {
        // ignore
      }
      p.lap('unread')
    } catch {
      // api 层已 toast
    } finally {
      p.end()
    }
  }

  if (loading) {
    return (
      <View className='home'>
        <View className='paper-grain' />
        <View className='center'>
          <Text className='muted'>登录中…</Text>
        </View>
      </View>
    )
  }

  const now = new Date()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekday}`
  const roleLabel = role === UserRole.Owner ? '管理员' : '教师'

  const todayStr = bjDateStr(Date.now())
  const today = weekSessions
    .filter((s) => bjDateStr(new Date(s.startTime).getTime()) === todayStr)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  const scheduledCount = weekSessions.filter((s) => s.status === 'scheduled').length
  const completed = weekSessions.filter((s) => s.status === 'completed')
  const consumed = completed.reduce((acc, s) => acc + presentCount(s), 0)

  // 铃铛：进消息中心（方案 A）。授权引导移到消息中心页内 banner。
  function onBell() {
    setUnread(0)
    Taro.navigateTo({ url: '/pages/messages/index' })
  }

  const quick: Quick[] = [
    { key: 'students', label: '学员', icon: 'people', sk: 'sk-1', onTap: () => Taro.reLaunch({ url: '/pages/students/list/index' }) },
    { key: 'recharge', label: '充值', icon: 'wallet', sk: 'sk-2', onTap: () => setShowRecharge(true) },
    { key: 'week', label: '课表', icon: 'calendar', sk: 'sk-3', onTap: () => Taro.reLaunch({ url: '/pages/schedule/index' }) },
    { key: 'stats', label: '统计', icon: 'chart', sk: 'sk-4', onTap: () => Taro.navigateTo({ url: '/pages/stats/index' }) }
  ]

  return (
    <View className='home'>
      <View className='paper-grain' />

      <View className='hero'>
        <Text className='cav hero-eyebrow'>today</Text>
        <Text className='hero-greeting'>{wsGreeting || '欢迎'}</Text>
        <Text className='hero-sub'>
          {roleLabel} · {dateLabel}
        </Text>
        <View className='hero-actions'>
          <View className='hero-act' onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
            <SketchIcon name='gear' size={44} color='#4A4030' />
          </View>
          <View className='hero-act' onClick={onBell}>
            <SketchIcon name='bell' size={46} color='#4A4030' />
            {unread > 0 ? <View className='hero-dot' /> : null}
          </View>
        </View>
      </View>

      <View className='quick-row'>
        {quick.map((q) => (
          <View key={q.key} className='quick-item' onClick={q.onTap}>
            <View className={`quick-chip paper-card ${q.sk}`}>
              <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
              <SketchIcon name={q.icon} size={44} color='#4A4030' />
            </View>
            <Text className='quick-label'>{q.label}</Text>
          </View>
        ))}
      </View>

      {/* 今日课程 */}
      <View className='sec-head'>
        <Text className='sec-title'>今日课程</Text>
        <Text className='sec-count'>{today.length} 节</Text>
      </View>
      {today.length === 0 ? (
        <View className='today-empty'>
          <Text className='cav today-empty-en'>free day</Text>
          <Text className='today-empty-cn'>今天没有课</Text>
        </View>
      ) : (
        today.map((s) => (
          <CourseCard
            key={s._id}
            session={s}
            nameMap={nameMap}
            onClick={() => Taro.navigateTo({ url: `/pages/course/detail/index?id=${s._id}` })}
          />
        ))
      )}

      {/* 本周课时统计 */}
      <View className='stat-card paper-card sk-3'>
        <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
        <View className='stat-head'>
          <Text className='cav stat-en'>this week</Text>
          <Text className='stat-title'>本周课时统计</Text>
          <Text className='stat-more' onClick={() => Taro.reLaunch({ url: '/pages/schedule/index' })}>
            看课表 ›
          </Text>
        </View>
        <View className='stat-row'>
          <View className='stat-item'>
            <Text className='stat-num accent'>{scheduledCount}</Text>
            <Text className='stat-label'>待上课</Text>
          </View>
          <View className='stat-div' />
          <View className='stat-item'>
            <Text className='stat-num'>{completed.length}</Text>
            <Text className='stat-label'>已完成</Text>
          </View>
          <View className='stat-div' />
          <View className='stat-item'>
            <Text className='stat-num'>{consumed}</Text>
            <Text className='stat-label'>消耗课时</Text>
          </View>
        </View>
      </View>

      {/* 课时不足预警 */}
      {lowStudents.length > 0 ? (
        <View className='warn-card sk-4'>
          <View className='warn-head'>
            <Text className='cav warn-en'>need top-up!</Text>
            <Text className='warn-count'>{lowStudents.length} 名</Text>
          </View>
          {lowStudents.map((s) => (
            <View
              key={s._id}
              className='warn-row'
              onClick={() => Taro.navigateTo({ url: `/pages/students/detail/index?id=${s._id}` })}
            >
              <Text className='warn-name'>{s.name}</Text>
              {s.levelTag ? <Text className='warn-level'>{s.levelTag}</Text> : null}
              <View className='warn-hours'>
                <View className='warn-num-box'>
                  <StatusMark status='oval' size={64} className='warn-circle' />
                  <Text className='warn-num'>{s.balance}</Text>
                </View>
                <Text className='warn-unit'>次</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <TabBar current='home' />

      <SheetModal visible={showRecharge} onClose={() => setShowRecharge(false)} title='课时充值'>
        <RechargeForm onDone={() => setShowRecharge(false)} />
      </SheetModal>

      <PaperToastHost />
    </View>
  )
}
