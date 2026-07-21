import { View } from '@tarojs/components'

/**
 * 手绘描边边框（可复用）。绝对定位铺满父容器，父容器需 position:relative。
 * weapp 用背景 SVG data URI 承载（抖动圆角矩形路径 + 非缩放描边）。
 * ⚠️ 需真机验证 weapp 对背景 SVG 的渲染；不渲染时退化为无边框（父容器自带 border 兜底）。
 */
interface Props {
  color?: string
  opacity?: number
  sw?: number
  className?: string
}

const PATH =
  'M20 6C90 3 150 8 210 5 262 3 294 6 295 22 297 58 293 104 296 130 297 146 278 145 250 146 182 149 110 143 56 147 10 149 5 142 5 128 3 96 7 54 4 24 3 9 12 6 20 6Z'

export default function SketchFrame({ color = '#3A3125', opacity = 0.5, sw = 1.5, className = '' }: Props) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 150' preserveAspectRatio='none'>` +
    `<path d='${PATH}' fill='none' stroke='${color}' stroke-opacity='${opacity}' stroke-width='${sw}' ` +
    `vector-effect='non-scaling-stroke' stroke-linecap='round' stroke-linejoin='round'/></svg>`
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return <View className={`sketch-frame ${className}`} style={{ backgroundImage: uri }} />
}
