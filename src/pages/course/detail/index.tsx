import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter, useLoad } from '@tarojs/taro'
import { SketchFrame, StatusMark } from '../../../components/sketch'
import SheetModal from '../../../components/SheetModal'
import {
  getSession,
  completeSession,
  markAbsentSession,
  cancelSession,
  reopenSession,
  SessionRow
} from '../../../services/sessions'
import { listStudents, getBalance } from '../../../services/students'
import { ensureQuota } from '../../../services/subscribe'
import { courseTypeLabel } from '../../../utils/courseType'
import { SessionStatus } from '../../../constants'
import { bjDateStr, bjTimeStr, bjWeekday } from '../../../utils/datetime'
import { PaperToastHost, showPaperToast } from '../../../components/PaperToast'
import './index.scss'

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  completed: '已完成',
  absent: '缺勤',
  cancelled: '已取消'
}

export default function CourseDetail() {
  const router = useRouter()
  const id = router.params.id as string
  const [session, setSession] = useState<SessionRow | null>(null)
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [balMap, setBalMap] = useState<Record<string, number>>({})
  const [showAtt, setShowAtt] = useState(false)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  useLoad(() => {
    if (id) load()
  })

  async function load() {
    try {
      const s = await getSession(id)
      setSession(s)
      const att: Record<string, boolean> = {}
      s.studentIds.forEach((sid) => (att[sid] = true))
      setAttendance(att)
      const { list } = await listStudents()
      const nm: Record<string, string> = {}
      list.forEach((st) => (nm[st._id] = st.name))
      setNameMap(nm)
      const bm: Record<string, number> = {}
      await Promise.all(
        s.studentIds.map(async (sid) => {
          try {
            const b = await getBalance(sid, { silent: true })
            bm[sid] = b.balance
          } catch {
            bm[sid] = NaN
          }
        })
      )
      setBalMap(bm)
    } catch {
      // api 层已 toast
    }
  }

  function studentName(sid: string): string {
    return nameMap[sid] || '学员已删除'
  }

  // 课时变动操作后：刷新余额、弹出每个学员的变化、返回周视图
  async function afterCreditOp() {
    if (!session) return
    const changes: string[] = []
    await Promise.all(
      session.studentIds.map(async (sid) => {
        const before = balMap[sid]
        try {
          const b = await getBalance(sid, { silent: true })
          if (before !== b.balance) changes.push(`${studentName(sid)} ${before} → ${b.balance}`)
        } catch {
          // ignore
        }
      })
    )
    showPaperToast(changes.length ? changes : ['课时无变化'])
    Taro.navigateBack()
  }

  async function doComplete(att?: Record<string, string>) {
    if (busy) return
    setBusy(true)
    try {
      await completeSession(id, att)
      await afterCreditOp()
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  function onComplete() {
    if (!session) return
    ensureQuota()
    if (session.studentIds.length <= 1) doComplete()
    else setShowAtt(true)
  }

  function confirmAttendance() {
    if (!session) return
    const map: Record<string, string> = {}
    session.studentIds.forEach((sid) => (map[sid] = attendance[sid] ? 'present' : 'absent'))
    setShowAtt(false)
    doComplete(map)
  }

  async function doMarkAbsent() {
    if (busy) return
    setBusy(true)
    try {
      await markAbsentSession(id)
      showPaperToast(['已标记缺勤'])
      Taro.navigateBack()
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  function onCancel() {
    Taro.showModal({
      title: '取消课程',
      content: '确认取消这节课？取消后不占用时段，不扣课时。',
      confirmText: '取消课程',
      confirmColor: '#C24A28',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await cancelSession(id)
          showPaperToast(['已取消课程'])
          Taro.navigateBack()
        } catch {
          // toasted
        }
      }
    })
  }

  async function onReopen() {
    if (busy) return
    setBusy(true)
    try {
      await reopenSession(id)
      await afterCreditOp()
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return (
      <View className='cd'>
        <View className='paper-grain' />
        <View className='cd-loading'>加载中…</View>
      </View>
    )
  }

  const ts = new Date(session.startTime).getTime()
  const dstr = bjDateStr(ts)
  const dateLabel = `${Number(dstr.slice(5, 7))}月${Number(dstr.slice(8, 10))}日 ${WD[bjWeekday(ts)]}`
  const timeRange = `${bjTimeStr(ts)}–${bjTimeStr(ts + session.durationMin * 60000)}`
  const isScheduled = session.status === SessionStatus.Scheduled

  return (
    <View className='cd'>
      <View className='paper-grain' />
      <View className='cd-inner'>
        <View className='cd-card paper-card sk-2'>
          <SketchFrame color='#3A3125' opacity={0.45} sw={1.5} />
          <View className='cd-status-row'>
            <StatusMark status={session.status as SessionStatus} size={36} />
            <Text className='cd-status-label' style={{ color: `var(--status-${session.status})` }}>
              {STATUS_LABEL[session.status] || session.status}
            </Text>
            <Text className='cd-dur'>{session.durationMin}分钟</Text>
          </View>
          <Text className='cd-time'>{timeRange}</Text>
          <View className='cd-meta'>
            <Text className='cd-date'>{dateLabel}</Text>
            <Text className='cd-type'>{courseTypeLabel(session)}</Text>
          </View>
        </View>

        <Text className='cd-section'>
          学员 <Text className='cd-count'>{session.studentIds.length > 1 ? `${session.studentIds.length}人小班` : '一对一'}</Text>
        </Text>
        {session.studentIds.map((sid) => (
          <View key={sid} className='cd-stu'>
            <View className='cd-avatar'>{nameMap[sid] ? nameMap[sid].slice(0, 1) : '–'}</View>
            <Text className='cd-stu-name'>{studentName(sid)}</Text>
            <View className='cd-stu-bal'>
              <Text className='cd-stu-num'>{Number.isNaN(balMap[sid]) ? '—' : balMap[sid] ?? '…'}</Text>
              <Text className='cd-stu-unit'>次</Text>
            </View>
          </View>
        ))}

        {session.note ? (
          <View className='cd-note'>
            <Text className='cd-note-label'>备注</Text>
            <Text className='cd-note-txt'>{session.note}</Text>
          </View>
        ) : null}

        <View className='cd-actions'>
          {isScheduled ? (
            <>
              <View className='cd-btn primary' onClick={onComplete}>
                <SketchFrame color='#20180E' opacity={0.5} sw={1.6} />
                <Text className='cd-btn-txt on-dark'>完成</Text>
              </View>
              <View className='cd-btn secondary' onClick={doMarkAbsent}>
                <Text className='cd-btn-txt'>缺勤</Text>
              </View>
              <View className='cd-btn danger' onClick={onCancel}>
                <Text className='cd-btn-txt on-danger'>取消课程</Text>
              </View>
            </>
          ) : (
            <View className='cd-btn secondary wide' onClick={onReopen}>
              <Text className='cd-btn-txt'>撤销 · 恢复待上课</Text>
            </View>
          )}
        </View>
      </View>

      <SheetModal visible={showAtt} onClose={() => setShowAtt(false)} title='出勤勾选'>
        <View className='att'>
          <Text className='att-hint'>默认全部出席，取消勾选的学员本节不扣课时</Text>
          {session.studentIds.map((sid) => (
            <View
              key={sid}
              className='att-row'
              onClick={() => setAttendance((a) => ({ ...a, [sid]: !a[sid] }))}
            >
              <View className={`att-check ${attendance[sid] ? 'on' : ''}`}>{attendance[sid] ? '✓' : ''}</View>
              <Text className='att-name'>{studentName(sid)}</Text>
              <Text className='att-state'>{attendance[sid] ? '出席 · 扣 1 次' : '缺席 · 不扣'}</Text>
            </View>
          ))}
          <View className='att-submit' onClick={busy ? undefined : confirmAttendance}>
            <SketchFrame color='#20180E' opacity={0.5} sw={1.6} />
            <Text className='att-submit-txt'>确认完成</Text>
          </View>
        </View>
      </SheetModal>

      <PaperToastHost />
    </View>
  )
}
