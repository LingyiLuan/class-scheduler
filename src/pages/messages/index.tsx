import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { SketchFrame } from '../../components/sketch'
import { listNotifications, markRead, quotaLow, NotiRow } from '../../services/notifications'
import { requestSubscribe, refreshQuotaSetting, quotaSettled } from '../../services/subscribe'
import { SUBSCRIBE_TMPL_IDS } from '../../constants/subscribe'
import { getCachedLogin } from '../../services/user'
import { UserRole } from '../../constants'
import { bjDateStr, bjTimeStr } from '../../utils/datetime'
import './index.scss'

const SK = ['sk-1', 'sk-2', 'sk-3', 'sk-4']

// 开发者工具（模拟器）拿不到订阅状态，banner 会常显——只在此环境加提示。真机永远为 false。
let IS_DEVTOOLS = false
try {
  IS_DEVTOOLS = Taro.getSystemInfoSync && Taro.getSystemInfoSync().platform === 'devtools'
} catch {
  // ignore
}

function timeLabel(iso: string): string {
  const ts = new Date(iso).getTime()
  return `${bjDateStr(ts).slice(5)} ${bjTimeStr(ts)}`
}

export default function Messages() {
  const [rows, setRows] = useState<NotiRow[]>([])
  const [loaded, setLoaded] = useState(false)
  // none=无 / enable=未勾总是保持 / topup=已勾但额度不足
  const [banner, setBanner] = useState<'none' | 'enable' | 'topup'>('none')

  useLoad(() => load())

  async function load() {
    // 家长端只做应用内消息，不订阅推送 → 不显示订阅 banner
    const isParent = getCachedLogin()?.role === UserRole.Student
    let b: 'none' | 'enable' | 'topup' = 'none'
    if (!isParent) {
      await refreshQuotaSetting()
      if (!quotaSettled()) {
        b = 'enable'
      } else {
        try {
          const q = await quotaLow()
          if (q.quotaLow) b = 'topup'
        } catch {
          // ignore
        }
      }
    }
    setBanner(b)
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

  // 授权/补额都在按钮点击手势内发起
  function onBannerTap() {
    requestSubscribe(SUBSCRIBE_TMPL_IDS)
    Taro.showToast({ title: banner === 'topup' ? '已请求补充额度' : '已请求开启提醒', icon: 'none' })
    setBanner('none')
    setTimeout(() => refreshQuotaSetting(), 800)
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

      {banner !== 'none' ? (
        <View className={`msg-banner sk-2 ${banner === 'topup' ? 'topup' : ''}`} onClick={onBannerTap}>
          <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
          <View className='banner-txt'>
            <Text className='banner-title'>{banner === 'topup' ? '提醒额度不足' : '开启自动提醒'}</Text>
            <Text className='banner-sub'>
              {banner === 'topup'
                ? '最近有提醒没能发出去，点此补充额度'
                : '勾选「总是保持以上选择」后，课前与课时提醒自动送达，无需每次确认'}
            </Text>
            {banner === 'enable' && IS_DEVTOOLS ? (
              <Text className='banner-devnote'>（模拟器无法检测订阅状态，此提示以真机为准）</Text>
            ) : null}
          </View>
          <Text className='banner-btn'>{banner === 'topup' ? '补充' : '开启'}</Text>
        </View>
      ) : null}

      {loaded && rows.length === 0 ? (
        <View className='msg-empty'>
          <Text className='cav msg-empty-en'>all clear</Text>
          <Text className='msg-empty-cn'>暂无消息</Text>
        </View>
      ) : (
        rows.map((n, i) => {
          // 需要行动的（课时不足/归零）用 coral 卡片强调；其余记录性消息常规样式。
          // 未读仍由圆点表达，两个维度互不干扰。
          const priority = n.type === 'lowCredit'
          return (
            <View
              key={n._id}
              className={`msg-card paper-card ${SK[i % SK.length]} ${priority ? 'priority' : ''}`}
              onClick={() => openRef(n)}
            >
              {priority ? null : <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />}
              <View className='msg-row'>
                {n.readAt ? null : <View className='msg-dot' />}
                <Text className={`msg-card-title ${priority ? 'coral' : ''}`}>{n.title}</Text>
                <Text className='msg-time'>{timeLabel(n.createdAt)}</Text>
              </View>
              <Text className='msg-body'>{n.body}</Text>
            </View>
          )
        })
      )}
    </View>
  )
}
