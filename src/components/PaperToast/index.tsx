import { useState, useEffect, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import { SketchFrame } from '../sketch'
import './index.scss'

/**
 * 纸质风信息反馈提示（非确认类）。顶部滑下 + 淡入，2 秒自动消失，支持多行。
 * 用法：任意处调 showPaperToast([...])，需展示的页面挂一个 <PaperToastHost />。
 * 采用全局触发是为了在抽屉关闭（表单卸载）后提示仍能留在宿主页面显示。
 */
type Listener = (lines: string[]) => void
const listeners = new Set<Listener>()

export function showPaperToast(lines: string[]) {
  listeners.forEach((l) => l(lines))
}

export function PaperToastHost() {
  const [visible, setVisible] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const l: Listener = (ls) => {
      setLines(ls)
      setVisible(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setVisible(false), 2000)
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <View className={`ptoast ${visible ? 'show' : ''}`}>
      <View className='ptoast-card'>
        <SketchFrame color='#3A3125' opacity={0.5} sw={1.5} />
        {lines.map((t, i) => (
          <Text key={i} className='ptoast-line'>
            {t}
          </Text>
        ))}
      </View>
    </View>
  )
}
