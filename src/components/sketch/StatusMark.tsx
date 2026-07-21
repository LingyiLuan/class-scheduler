import { View } from '@tarojs/components'
import { SessionStatus } from '../../constants'

/**
 * 课程状态记号（手写批改隐喻）：圈/勾/叉/划掉。
 * 另含课时不足的手绘圈选变体（variant='oval'）。
 * weapp 用背景 SVG data URI 承载。
 */
type MarkKey = SessionStatus | 'oval'

const MARKS: Record<string, { vb: string; d: string; color: string }> = {
  [SessionStatus.Scheduled]: {
    vb: '0 0 18 18',
    d: 'M9 3.3C12.4 3.2 14.9 5.4 14.8 9c-.1 3.5-2.5 5.8-6 5.7C5.5 14.6 3.2 12.3 3.3 8.8 3.4 5.5 5.6 3.4 9 3.3Z',
    color: '#7A6E58'
  },
  [SessionStatus.Completed]: { vb: '0 0 18 18', d: 'M3.8 9.2 7.4 12.8 15 4.6', color: '#3E8C7E' },
  [SessionStatus.Absent]: { vb: '0 0 18 18', d: 'M5 5 13 13M13 5 5 13', color: '#C24A28' },
  [SessionStatus.Cancelled]: {
    vb: '0 0 18 18',
    d: 'M3.5 9.2c2 .8 4.2 .9 6.6 .3 1.9-.5 3-.5 4.4 .1',
    color: '#A2937B'
  },
  // 课时不足的手绘圈选（横向椭圆），套在数字外
  oval: {
    vb: '0 0 52 34',
    d: 'M27 3C39 2.5 49 8 49 16.5 49 26 38 32 25 31.5 12 31 3 25 3 16 3 8 15 3.5 27 3Z',
    color: '#F07850'
  }
}

interface Props {
  status: MarkKey
  /** 尺寸（rpx）；oval 变体建议传更宽的容器由 className 控制 */
  size?: number
  className?: string
}

export default function StatusMark({ status, size = 36, className = '' }: Props) {
  const m = MARKS[status] || MARKS[SessionStatus.Scheduled]
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${m.vb}' fill='none' stroke='${m.color}' ` +
    `stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'><path d='${m.d}'/></svg>`
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return (
    <View
      className={`status-mark ${className}`}
      style={{ width: `${size}rpx`, height: `${size}rpx`, backgroundImage: uri }}
    />
  )
}
