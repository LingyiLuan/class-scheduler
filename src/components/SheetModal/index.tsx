import { useRef } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

/**
 * 底部半屏抽屉（手绘纸质风）。撕纸顶边 + 拖拽条 + 暗背景 + 内部滚动。
 * 下滑抽屉头部或点背景关闭。children 仅在 visible 时挂载（每次打开都是新的）。
 */
interface Props {
  visible: boolean
  onClose: () => void
  title?: string
  children?: React.ReactNode
}

export default function SheetModal({ visible, onClose, title, children }: Props) {
  const startY = useRef(0)

  return (
    <View
      className={`sm-mask ${visible ? 'show' : ''}`}
      catchMove
      onClick={onClose}
    >
      <View className={`sm-sheet ${visible ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
        <View className='sm-torn' />
        <View className='sm-paper'>
          <View
            className='sm-head'
            onTouchStart={(e: any) => {
              startY.current = e.touches[0]?.clientY ?? 0
            }}
            onTouchEnd={(e: any) => {
              const dy = (e.changedTouches[0]?.clientY ?? 0) - startY.current
              if (dy > 60) onClose()
            }}
          >
            <View className='sm-grip' />
            {title ? <Text className='sm-title'>{title}</Text> : null}
          </View>
          <ScrollView scrollY className='sm-body'>
            {visible ? children : null}
          </ScrollView>
        </View>
      </View>
    </View>
  )
}
