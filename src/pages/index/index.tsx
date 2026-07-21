import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ensureLogin, canAccessApp } from '../../services/user'
import { UserRole } from '../../constants'
import './index.scss'

export default function Index() {
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('')

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
        // 未激活或非教师角色 → 待激活提示页
        Taro.redirectTo({ url: '/pages/pending/index' })
      }
    } catch {
      setLoading(false)
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  }

  if (loading) {
    return (
      <View className='center'>
        <Text className='muted'>登录中…</Text>
      </View>
    )
  }

  return (
    <View className='home'>
      <Text className='home-title'>课表管理</Text>
      <Text className='home-sub'>{role === UserRole.Owner ? '管理员' : '教师'}</Text>
      <Text className='home-hint'>学员、课表、课时功能开发中</Text>
    </View>
  )
}
