import { View } from '@tarojs/components'

/**
 * 铅笔线性图标。weapp 用背景 SVG data URI 承载（与 SketchFrame 同技法，已验证可用）。
 */
const ICONS: Record<string, string> = {
  home: "<path d='M3.5 11.5 12 4.5l8.5 7'/><path d='M6 10v9.5h12V10'/>",
  calendar: "<rect x='3' y='4.5' width='18' height='16' rx='2.5'/><path d='M3 9h18M8 2.5v4M16 2.5v4'/>",
  people:
    "<circle cx='9' cy='8' r='3.2'/><path d='M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5'/><path d='M16 5.2a3 3 0 010 5.6M18 20c0-2.6-1-4.4-2.5-5.4'/>",
  wallet: "<rect x='2.5' y='5.5' width='19' height='13' rx='2.5'/><path d='M2.5 10h19'/><path d='M6 14.5h4'/>",
  plus: "<circle cx='12' cy='12' r='9'/><path d='M12 8v8M8 12h8'/>",
  chart: "<path d='M4 20V11'/><path d='M10 20V5'/><path d='M16 20V14'/><path d='M2 20h20'/>",
  bell: "<path d='M6 9.5a6 6 0 0112 0c0 4.5 1.8 5.8 2.2 6.2a.6.6 0 01-.4 1H4.2a.6.6 0 01-.4-1C4.2 15.3 6 14 6 9.5z'/><path d='M9.8 20a2.3 2.3 0 004.4 0'/>",
  gear: "<circle cx='12' cy='12' r='3.3'/><path d='M12 2.4v3.1M12 18.5v3.1M21.6 12h-3.1M5.5 12H2.4M18.8 5.2l-2.2 2.2M7.4 16.6l-2.2 2.2M18.8 18.8l-2.2-2.2M7.4 7.4 5.2 5.2'/>"
}

interface Props {
  name: keyof typeof ICONS | string
  size?: number
  color?: string
  className?: string
}

export default function SketchIcon({ name, size = 44, color = '#4A4030', className = '' }: Props) {
  const inner = ICONS[name] || ''
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${color}' ` +
    `stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'>${inner}</svg>`
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return (
    <View
      className={`sketch-icon ${className}`}
      style={{ width: `${size}rpx`, height: `${size}rpx`, backgroundImage: uri }}
    />
  )
}
