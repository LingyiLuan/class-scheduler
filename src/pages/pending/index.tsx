import { useState } from 'react'
import { View, Text, Button, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getCachedLogin, refreshLogin, canAccessApp, setDisplayName } from '../../services/user'
import { bindByCode } from '../../services/invites'
import { UserRole } from '../../constants'
import './index.scss'

const PH = 'color:#B5A88C'

export default function Pending() {
  const cached = getCachedLogin()
  const [code, setCode] = useState('')
  const [binding, setBinding] = useState(false)
  const [name, setName] = useState((cached && cached.displayName) || '')
  const [savedName, setSavedName] = useState((cached && cached.displayName) || '')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)

  useDidShow(() => {
    const c = getCachedLogin()
    if (c?.displayName) setSavedName(c.displayName)
  })

  // 家长：输码绑定 → 自助成为家长并激活 → 进家长端
  async function onBind() {
    const c = code.trim()
    if (!c) return Taro.showToast({ title: '请输入邀请码', icon: 'none' })
    setBinding(true)
    try {
      const r = await bindByCode(c)
      await refreshLogin()
      Taro.showToast({ title: r.already ? '你已绑定该学员' : `已绑定 ${r.studentName}`, icon: 'none' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/parent/index' }), 700)
    } catch (e) {
      Taro.showToast({ title: (e as { message?: string })?.message || '绑定失败', icon: 'none' })
    } finally {
      setBinding(false)
    }
  }

  // 老师：自报姓名，等管理员激活
  async function saveName() {
    const n = name.trim()
    if (!n) return Taro.showToast({ title: '请填写姓名', icon: 'none' })
    setSaving(true)
    try {
      await setDisplayName(n)
      setSavedName(n)
      Taro.showToast({ title: '已提交', icon: 'none' })
    } catch {
      // toasted
    } finally {
      setSaving(false)
    }
  }

  async function recheck() {
    setChecking(true)
    try {
      const fresh = await refreshLogin()
      if (canAccessApp(fresh)) {
        Taro.redirectTo({
          url: fresh.role === UserRole.Student ? '/pages/parent/index' : '/pages/index/index'
        })
      } else {
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
      <View className='pending-hero'>
        <Text className='cav pending-eyebrow'>welcome</Text>
        <Text className='pending-welcome'>欢迎</Text>
      </View>

      {/* 学生 / 家长（主） */}
      <View className='pending-card primary'>
        <Text className='pending-card-title'>我是学生</Text>
        <Text className='pending-card-sub'>输入老师给的邀请码，查看课表与剩余课时（家长代看也用这里）</Text>
        <View className='pending-row'>
          <Input
            className='pending-input'
            value={code}
            onInput={(e) => setCode(e.detail.value)}
            placeholder='输入邀请码'
            placeholderStyle={PH}
          />
          <Text className={`pending-btn ${binding ? 'off' : ''}`} onClick={binding ? undefined : onBind}>
            绑定
          </Text>
        </View>
      </View>

      {/* 老师（次） */}
      <View className='pending-card'>
        <Text className='pending-card-title'>我是老师</Text>
        <Text className='pending-card-sub'>填写姓名，等待管理员激活</Text>
        <View className='pending-row'>
          <Input
            className='pending-input'
            value={name}
            onInput={(e) => setName(e.detail.value)}
            placeholder='你的姓名'
            placeholderStyle={PH}
          />
          <Text className={`pending-btn ghost ${saving ? 'off' : ''}`} onClick={saving ? undefined : saveName}>
            {savedName ? '更新' : '提交'}
          </Text>
        </View>
        {savedName ? <Text className='pending-hint'>已提交「{savedName}」，请等管理员激活</Text> : null}
        <Button className='pending-recheck' loading={checking} onClick={recheck}>
          已激活？重新检测
        </Button>
      </View>
    </View>
  )
}
