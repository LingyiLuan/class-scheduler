import { View, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { callFunction, ApiError } from '../../services/api'
import './index.scss'

export default function Index() {

  useLoad(() => {
    console.log('Page loaded.')
  })

  // TODO 临时调试：验证小程序端 → login 云函数完整链路，验证后删除
  const handleTestLogin = async () => {
    try {
      const data = await callFunction('login', {}, { loading: '登录中', silent: true })
      console.log('[测试登录] 成功，返回：', data)
      Taro.showModal({
        title: '登录成功',
        content: JSON.stringify(data),
        showCancel: false
      })
    } catch (e) {
      const err = e as ApiError
      console.log('[测试登录] 失败：', err)
      Taro.showModal({
        title: '登录失败',
        content: `code=${err.code}\n${err.message}`,
        showCancel: false
      })
    }
  }

  return (
    <View className='index'>
      {/* TODO 临时调试入口，验证后删除 */}
      <Button type='primary' onClick={handleTestLogin}>测试登录</Button>
      <Button onClick={() => Taro.navigateTo({ url: '/pages/debug/index' })}>打开调试面板</Button>
    </View>
  )
}
