import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ensureLogin, isOwnerActive } from '../../services/user'
import './index.scss'

export default function Index() {
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    route()
  })

  async function route() {
    setLoading(true)
    try {
      const info = await ensureLogin()
      if (isOwnerActive(info)) {
        setLoading(false)
      } else {
        // 非管理员或未激活 → 待激活提示页
        Taro.redirectTo({ url: '/pages/pending/index' })
      }
    } catch {
      setLoading(false)
      Taro.showToast({ title: '登录失败，请下拉重试', icon: 'none' })
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
      <Text className='home-sub'>管理员</Text>
      <Text className='home-hint'>学员、课表、课时功能开发中</Text>
    </View>
  )
}
