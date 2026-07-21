import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { Button, Cell, CellGroup, Empty } from '@nutui/nutui-react-taro'
import dayjs from 'dayjs'
import {
  getStudent,
  getBalance,
  listStudentSessions,
  deleteStudent,
  Student,
  SessionBrief
} from '../../../services/students'
import './index.scss'

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  completed: '已完成',
  absent: '缺勤',
  cancelled: '已取消'
}
const COURSE_LABEL: Record<string, string> = {
  makeup: '补课',
  cambridge: '剑桥'
}

export default function StudentDetail() {
  const router = useRouter()
  const id = router.params.id as string
  const [stu, setStu] = useState<Student | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<SessionBrief[]>([])

  useDidShow(() => {
    if (id) load()
  })

  async function load() {
    try {
      const s = await getStudent(id)
      setStu(s)
      const b = await getBalance(id, { silent: true })
      setBalance(b.balance)
      const h = await listStudentSessions(id)
      setHistory(h.list)
    } catch {
      // api 层已 toast
    }
  }

  function onDelete() {
    Taro.showModal({
      title: '删除学员',
      content: `确认删除「${stu?.name}」？删除后列表不再显示，其课时流水与历史课程保留。`,
      confirmText: '删除',
      confirmColor: '#c0392b',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await deleteStudent(id)
          Taro.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => Taro.navigateBack(), 600)
        } catch {
          // toasted
        }
      }
    })
  }

  if (!stu) {
    return (
      <View className='center'>
        <Text className='muted'>加载中…</Text>
      </View>
    )
  }

  return (
    <View className='stu-detail'>
      <CellGroup>
        <Cell title='姓名' extra={stu.name} />
        <Cell title='手机号' extra={stu.phone || '—'} />
        <Cell title='级别' extra={stu.levelTag || '—'} />
        <Cell title='邀请码' extra={stu.inviteCode || '—'} />
        <Cell title='剩余课时' extra={`${balance ?? '…'} 次`} />
        {stu.note ? <Cell title='备注' extra={stu.note} /> : null}
      </CellGroup>

      <View className='section-title'>历史上课记录</View>
      {history.length === 0 ? (
        <Empty description='暂无上课记录' />
      ) : (
        <CellGroup>
          {history.map((s) => (
            <Cell
              key={s._id}
              title={`${dayjs(s.startTime).format('MM-DD HH:mm')} · ${COURSE_LABEL[s.courseType] || s.courseType}`}
              extra={STATUS_LABEL[s.status] || s.status}
            />
          ))}
        </CellGroup>
      )}

      <View className='actions'>
        <Button
          type='primary'
          block
          onClick={() => Taro.navigateTo({ url: `/pages/recharge/index?studentId=${id}` })}
        >
          充值
        </Button>
        <View className='gap' />
        <Button block onClick={() => Taro.navigateTo({ url: `/pages/students/form/index?id=${id}` })}>
          编辑
        </Button>
        <View className='gap' />
        <Button block className='danger' onClick={onDelete}>
          删除学员
        </Button>
      </View>
    </View>
  )
}
