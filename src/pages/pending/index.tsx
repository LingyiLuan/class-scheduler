import { useState } from 'react'
import { View, Text, Button, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getCachedLogin, refreshLogin, canAccessApp, setDisplayName, LoginInfo } from '../../services/user'
import './index.scss'

export default function Pending() {
  const [info, setInfo] = useState<LoginInfo | null>(getCachedLogin())
  const [checking, setChecking] = useState(false)
  const [name, setName] = useState((getCachedLogin() && getCachedLogin()?.displayName) || '')
  const [savedName, setSavedName] = useState((getCachedLogin() && getCachedLogin()?.displayName) || '')
  const [saving, setSaving] = useState(false)

  useDidShow(() => {
    const c = getCachedLogin()
    setInfo(c)
    if (c?.displayName) setSavedName(c.displayName)
  })

  const message = !info
    ? '未获取到账号信息，请重新检测'
    : !info.isActive
      ? '账号待激活，请联系管理员激活后再使用'
      : '当前版本暂只开放教师使用'

  // 待激活用户填姓名，方便管理员在成员列表识别是谁
  const needName = !!info && !info.isActive

  async function saveName() {
    const n = name.trim()
    if (!n) return Taro.showToast({ title: '请填写姓名', icon: 'none' })
    setSaving(true)
    try {
      await setDisplayName(n)
      setSavedName(n)
      Taro.showToast({ title: '已提交', icon: 'none' })
    } catch {
      // api 层已 toast
    } finally {
      setSaving(false)
    }
  }

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

      {needName ? (
        <View className='pending-name'>
          <Text className='pending-name-hint'>
            {savedName ? `已提交姓名：${savedName}` : '填写你的姓名，方便管理员识别并激活'}
          </Text>
          <View className='pending-name-row'>
            <Input
              className='pending-name-input'
              value={name}
              onInput={(e) => setName(e.detail.value)}
              placeholder='如 Ruby / 王老师'
              placeholderStyle='color:#B5A88C'
            />
            <Text
              className={`pending-name-btn ${saving ? 'off' : ''}`}
              onClick={saving ? undefined : saveName}
            >
              {savedName ? '更新' : '提交'}
            </Text>
          </View>
        </View>
      ) : null}

      <Button className='pending-btn' type='primary' loading={checking} onClick={recheck}>
        重新检测
      </Button>
    </View>
  )
}
