import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import '@nutui/nutui-react-taro/dist/style.css'
import { CLOUD_ENV } from './constants/cloud'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {

  useLaunch(() => {
    if (Taro.cloud) {
      Taro.cloud.init({ env: CLOUD_ENV, traceUser: true })
    } else {
      console.error('当前环境不支持云开发，请用微信开发者工具打开并开通云开发')
    }
  })

  // children 是将要会渲染的页面
  return children
}

export default App
