import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ensureLogin, canAccessApp } from '../../services/user'
import { getChildren, Child } from '../../services/parent'
import { getGreeting } from '../../services/config'
import { unreadCount } from '../../services/notifications'
import { UserRole } from '../../constants'
import { SketchFrame, SketchIcon } from '../../components/sketch'
import { PaperToastHost } from '../../components/PaperToast'
import './index.scss'

export default function ParentHome() {
  const [children, setChildren] = useState<Child[]>([])
  const [greeting, setGreeting] = useState('')
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useDidShow(() => route())

  async function route() {
    try {
      const info = await ensureLogin()
      if (!canAccessApp(info) || info.role !== UserRole.Student) {
        Taro.reLaunch({ url: '/pages/index/index' })
        return
      }
      load()
    } catch {
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  }

  async function load() {
    try {
      const { list } = await getChildren()
      setChildren(list)
      getGreeting()
        .then((g) => setGreeting(g.greeting))
        .catch(() => {})
      try {
        const u = await unreadCount()
        setUnread(u.count)
      } catch {
        // ignore
      }
    } catch {
      // toasted
    } finally {
      setLoaded(true)
    }
  }

  function onBell() {
    setUnread(0)
    Taro.navigateTo({ url: '/pages/messages/index' })
  }

  return (
    <View className='ph'>
      <View className='paper-grain' />

      <View className='ph-hero'>
        <Text className='cav ph-eyebrow'>my kids</Text>
        <Text className='ph-greeting'>{greeting || '我的孩子'}</Text>
        <View className='ph-bell' onClick={onBell}>
          <SketchIcon name='bell' size={46} color='#4A4030' />
          {unread > 0 ? <View className='ph-dot' /> : null}
        </View>
      </View>

      {loaded && children.length === 0 ? (
        <View className='ph-empty'>
          <Text className='cav ph-empty-en'>no kids yet</Text>
          <Text className='ph-empty-cn'>还没有绑定孩子。向老师索取邀请码，在待激活页输入即可绑定。</Text>
        </View>
      ) : (
        children.map((c, i) => {
          const low = c.balance <= 2
          return (
            <View
              key={c._id}
              className={`ph-card paper-card sk-${(i % 4) + 1}`}
              onClick={() => Taro.navigateTo({ url: `/pages/parent/child/index?id=${c._id}` })}
            >
              <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
              <View className='ph-avatar'>{c.name.slice(0, 1)}</View>
              <View className='ph-info'>
                <View className='ph-nameline'>
                  <Text className='ph-name'>
                    {c.name}
                    {c.aliasCn ? `（${c.aliasCn}）` : ''}
                  </Text>
                  {c.levelTag ? <Text className='ph-level'>{c.levelTag}</Text> : null}
                </View>
                {low ? (
                  <Text className='ph-low'>课时不足，请联系老师续费</Text>
                ) : (
                  <Text className='ph-bal'>剩余 {c.balance} 课时</Text>
                )}
              </View>
              <Text className='ph-arrow'>›</Text>
            </View>
          )
        })
      )}

      <PaperToastHost />
    </View>
  )
}
