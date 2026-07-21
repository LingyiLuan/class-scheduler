import { View, Text } from '@tarojs/components'
import TabBar from '../../components/TabBar'
import './index.scss'

// 占位：排课周视图下一步实现（4.1）
export default function Schedule() {
  return (
    <View className='schedule'>
      <View className='paper-grain' />
      <Text className='sched-title'>课表</Text>
      <View className='sched-empty'>
        <Text className='cav sched-en'>coming soon</Text>
        <Text className='sched-hint'>排课周视图开发中</Text>
      </View>
      <TabBar current='schedule' />
    </View>
  )
}
