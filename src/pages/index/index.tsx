import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ensureLogin, canAccessApp } from '../../services/user'
import { UserRole } from '../../constants'
import { SketchFrame, SketchIcon } from '../../components/sketch'
import TabBar from '../../components/TabBar'
import SheetModal from '../../components/SheetModal'
import RechargeForm from '../../components/RechargeForm'
import './index.scss'

interface Quick {
  key: string
  label: string
  icon: string
  sk: string
  onTap: () => void
}

export default function Index() {
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('')
  const [showRecharge, setShowRecharge] = useState(false)

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
      } else {
        Taro.redirectTo({ url: '/pages/pending/index' })
      }
    } catch {
      setLoading(false)
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
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
  const h = now.getHours()
  const greeting = h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好'
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekday}`
  const roleLabel = role === UserRole.Owner ? '管理员' : '教师'

  const quick: Quick[] = [
    {
      key: 'students',
      label: '学员',
      icon: 'people',
      sk: 'sk-1',
      onTap: () => Taro.reLaunch({ url: '/pages/students/list/index' })
    },
    {
      key: 'recharge',
      label: '充值',
      icon: 'wallet',
      sk: 'sk-2',
      onTap: () => setShowRecharge(true)
    },
    {
      key: 'week',
      label: '课表',
      icon: 'calendar',
      sk: 'sk-3',
      onTap: () => Taro.reLaunch({ url: '/pages/schedule/index' })
    },
    {
      key: 'new',
      label: '新建课程',
      icon: 'plus',
      sk: 'sk-4',
      onTap: () => Taro.showToast({ title: '功能开发中', icon: 'none' })
    }
  ]

  return (
    <View className='home'>
      <View className='paper-grain' />

      <View className='hero'>
        <Text className='cav hero-eyebrow'>today</Text>
        <Text className='hero-greeting'>{greeting}</Text>
        <Text className='hero-sub'>
          {roleLabel} · {dateLabel}
        </Text>
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

      <View className='wave-divider home-wave' />
      <Text className='home-note'>今日课程 · 本周统计 · 课时预警（排课完成后补齐）</Text>

      <TabBar current='home' />

      <SheetModal visible={showRecharge} onClose={() => setShowRecharge(false)} title='课时充值'>
        <RechargeForm onDone={() => setShowRecharge(false)} />
      </SheetModal>
    </View>
  )
}
