import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { SketchFrame } from '../../components/sketch'
import { listNotifications, markRead, NotiRow } from '../../services/notifications'
import { requestSubscribe, refreshQuotaSetting, quotaSettled } from '../../services/subscribe'
import { SUBSCRIBE_TMPL_IDS } from '../../constants/subscribe'
import { bjDateStr, bjTimeStr } from '../../utils/datetime'
import './index.scss'

const SK = ['sk-1', 'sk-2', 'sk-3', 'sk-4']

function timeLabel(iso: string): string {
  const ts = new Date(iso).getTime()
  return `${bjDateStr(ts).slice(5)} ${bjTimeStr(ts)}`
}

export default function Messages() {
  const [rows, setRows] = useState<NotiRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useLoad(() => load())

  async function load() {
    await refreshQuotaSetting()
    setShowBanner(!quotaSettled())
    try {
      const { list } = await listNotifications(1)
      setRows(list)
      // 进入即全部已读（清首页红点）；本次仍按拉取时的未读态显示圆点
      if (list.some((n) => !n.readAt)) markRead()
    } catch {
      // toasted
    } finally {
      setLoaded(true)
    }
  }

  // 授权在按钮点击手势内发起；成功后隐藏 banner
  function onEnable() {
    requestSubscribe(SUBSCRIBE_TMPL_IDS)
    Taro.showToast({ title: '已请求开启提醒', icon: 'none' })
    setTimeout(() => {
      refreshQuotaSetting().then(() => setShowBanner(!quotaSettled()))
    }, 800)
  }

  function openRef(n: NotiRow) {
    if (n.refType === 'session' && n.refId) {
      Taro.navigateTo({ url: `/pages/course/detail/index?id=${n.refId}` })
    } else if (n.refType === 'student' && n.refId) {
      Taro.navigateTo({ url: `/pages/students/detail/index?id=${n.refId}` })
    }
  }

  return (
    <View className='msgs'>
      <View className='paper-grain' />

      <View className='msg-head'>
        <Text className='msg-title'>消息</Text>
      </View>

      {showBanner ? (
        <View className='msg-banner sk-2' onClick={onEnable}>
          <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
          <View className='banner-txt'>
            <Text className='banner-title'>开启自动提醒</Text>
            <Text className='banner-sub'>勾选「总是保持以上选择」后，课前与课时提醒自动送达，无需每次确认</Text>
          </View>
          <Text className='banner-btn'>开启</Text>
        </View>
      ) : null}

      {loaded && rows.length === 0 ? (
        <View className='msg-empty'>
          <Text className='cav msg-empty-en'>all clear</Text>
          <Text className='msg-empty-cn'>暂无消息</Text>
        </View>
      ) : (
        rows.map((n, i) => (
          <View
            key={n._id}
            className={`msg-card paper-card ${SK[i % SK.length]}`}
            onClick={() => openRef(n)}
          >
            <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
            <View className='msg-row'>
              {n.readAt ? null : <View className='msg-dot' />}
              <Text className='msg-card-title'>{n.title}</Text>
              <Text className='msg-time'>{timeLabel(n.createdAt)}</Text>
            </View>
            <Text className='msg-body'>{n.body}</Text>
          </View>
        ))
      )}
    </View>
  )
}
