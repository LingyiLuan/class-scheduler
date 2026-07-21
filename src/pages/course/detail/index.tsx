import { View, Text } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import './index.scss'

// 占位：课程详情与操作（完成/缺勤/取消/撤销）在第 5 项实现
export default function CourseDetail() {
  const router = useRouter()
  const id = router.params.id
  return (
    <View className='course-detail'>
      <View className='paper-grain' />
      <Text className='cd-title'>课程详情</Text>
      <Text className='cd-id'>id：{id || '—'}</Text>
      <Text className='cd-hint'>完成 / 缺勤 / 取消 / 撤销 等操作开发中（第 5 项）</Text>
    </View>
  )
}
