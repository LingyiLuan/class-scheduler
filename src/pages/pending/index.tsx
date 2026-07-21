import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getCachedLogin, refreshLogin, canAccessApp, LoginInfo } from '../../services/user'
import './index.scss'

export default function Pending() {
  const [info, setInfo] = useState<LoginInfo | null>(getCachedLogin())
  const [checking, setChecking] = useState(false)

  useDidShow(() => {
    setInfo(getCachedLogin())
  })

  const message = !info
    ? '未获取到账号信息，请重新检测'
    : !info.isActive
      ? '账号待激活，请联系管理员激活后再使用'
      : '当前版本暂只开放教师使用'

  async function recheck() {
    setChecking(true)
    try {
      const fresh = await refreshLogin()
      if (canAccessApp(fresh)) {
        Taro.redirectTo({ url: '/pages/index/index' })
      } else {
        setInfo(fresh)
        Taro.showToast({ title: '仍未激活', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '检测失败，请重试', icon: 'none' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <View className='pending'>
      <Text className='pending-icon'>🔒</Text>
      <Text className='pending-msg'>{message}</Text>
      <Button className='pending-btn' type='primary' loading={checking} onClick={recheck}>
        重新检测
      </Button>
    </View>
  )
}
