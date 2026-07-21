import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { SketchIcon } from '../sketch'
import './index.scss'

/**
 * 自绘底部导航（手绘纸质风）。三个顶级页面各自渲染 <TabBar current=... />。
 * tab 间用 reLaunch 切换（清栈，符合 tab 语义）；子页面（详情/表单/充值）不含 tabbar。
 */
export type TabKey = 'home' | 'schedule' | 'students'

const TABS: { key: TabKey; label: string; icon: string; url: string }[] = [
  { key: 'home', label: '首页', icon: 'home', url: '/pages/index/index' },
  { key: 'schedule', label: '课表', icon: 'calendar', url: '/pages/schedule/index' },
  { key: 'students', label: '学员', icon: 'people', url: '/pages/students/list/index' }
]

export default function TabBar({ current }: { current: TabKey }) {
  return (
    <View className='tabbar'>
      {TABS.map((t) => {
        const active = t.key === current
        return (
          <View
            key={t.key}
            className='tabbar-item'
            onClick={() => {
              if (!active) Taro.reLaunch({ url: t.url })
            }}
          >
            <SketchIcon name={t.icon} size={44} color={active ? '#33291C' : '#A2937B'} />
            <Text className={`tabbar-label ${active ? 'on' : ''}`}>{t.label}</Text>
          </View>
        )
      })}
    </View>
  )
}
