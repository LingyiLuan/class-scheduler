import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import {
  getStudent,
  getBalance,
  listStudentSessions,
  deleteStudent,
  deactivateStudent,
  reactivateStudent,
  Student,
  SessionBrief
} from '../../../services/students'
import { ApiError } from '../../../services/api'
import { getInvite, generateInvite, disableInvite, unbindGuardian, Guardian } from '../../../services/invites'
import { SketchFrame, StatusMark } from '../../../components/sketch'
import SheetModal from '../../../components/SheetModal'
import StudentForm from '../../../components/StudentForm'
import RechargeForm from '../../../components/RechargeForm'
import { SessionStatus } from '../../../constants'
import { bjDateStr, bjTimeStr } from '../../../utils/datetime'
import { courseTypeLabel } from '../../../utils/courseType'
import { PaperToastHost, showPaperToast } from '../../../components/PaperToast'
import './index.scss'

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待上课',
  completed: '已完成',
  absent: '缺勤',
  cancelled: '已取消'
}

export default function StudentDetail() {
  const router = useRouter()
  const id = router.params.id as string
  const [stu, setStu] = useState<Student | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<SessionBrief[]>([])
  const [showEdit, setShowEdit] = useState(false)
  const [showRecharge, setShowRecharge] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [guardians, setGuardians] = useState<Guardian[]>([])

  useDidShow(() => {
    if (id) load()
  })

  async function loadInvite() {
    try {
      const inv = await getInvite(id)
      setInviteCode(inv.code)
      setGuardians(inv.guardians)
    } catch {
      // ignore
    }
  }

  async function load() {
    try {
      const s = await getStudent(id)
      setStu(s)
      const b = await getBalance(id, { silent: true })
      setBalance(b.balance)
      const h = await listStudentSessions(id)
      setHistory(h.list)
      loadInvite()
    } catch {
      // api 层已 toast
    }
  }

  function onDelete() {
    Taro.showModal({
      title: '删除学员',
      content: `确认删除「${stu?.name}」？删除后列表不再显示，其课时流水与历史课程保留。`,
      confirmText: '删除',
      confirmColor: '#C24A28',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await deleteStudent(id)
          showPaperToast(['已删除'])
          Taro.navigateBack()
        } catch (e) {
          const err = e as ApiError
          if (err.code === 40002) {
            // 有课程引用不可硬删，引导改为停用
            Taro.showModal({
              title: '无法删除',
              content: '该学员有课程记录，删除会影响历史。是否改为「停用」（从列表隐藏，历史保留）？',
              confirmText: '停用',
              success: async (r) => {
                if (!r.confirm) return
                try {
                  await deactivateStudent(id)
                  showPaperToast(['已停用'])
                  Taro.navigateBack()
                } catch {
                  // toasted
                }
              }
            })
          } else {
            Taro.showToast({ title: err.message || '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  async function onGenerate() {
    try {
      const r = await generateInvite(id)
      setInviteCode(r.code)
      showPaperToast(['邀请码已生成'])
    } catch {
      // toasted
    }
  }

  function onDisableInvite() {
    Taro.showModal({
      title: '作废邀请码',
      content: '作废后该码立即失效，已绑定的家长不受影响。可随时重新生成。',
      confirmText: '作废',
      confirmColor: '#C24A28',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await disableInvite(id)
          setInviteCode(null)
          showPaperToast(['已作废'])
        } catch {
          // toasted
        }
      }
    })
  }

  function onUnbind(g: Guardian) {
    Taro.showModal({
      title: '解绑家长',
      content: '解绑后该家长将看不到这个孩子。确认？',
      confirmText: '解绑',
      confirmColor: '#C24A28',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await unbindGuardian(g._id)
          showPaperToast(['已解绑'])
          loadInvite()
        } catch {
          // toasted
        }
      }
    })
  }

  function onReactivate() {
    Taro.showModal({
      title: '恢复学员',
      content: `将「${stu?.name}」恢复到在读列表？`,
      confirmText: '恢复',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await reactivateStudent(id)
          showPaperToast(['已恢复，回到在读列表'])
          Taro.navigateBack()
        } catch {
          // toasted
        }
      }
    })
  }

  if (!stu) {
    return (
      <View className='sd'>
        <View className='paper-grain' />
        <View className='sd-loading'>加载中…</View>
      </View>
    )
  }

  const low = (balance ?? 0) <= 2

  return (
    <View className='sd'>
      <View className='paper-grain' />
      <View className='sd-inner'>
        <View className='sd-card paper-card sk-2'>
          <SketchFrame color='#3A3125' opacity={0.45} sw={1.5} />
          <View className='sd-top'>
            <View className='sd-avatar'>{stu.name.slice(0, 1)}</View>
            <View className='sd-idbox'>
              <View className='sd-nameline'>
                <Text className='sd-name'>{stu.name}</Text>
                {stu.levelTag ? <Text className='sd-level'>{stu.levelTag}</Text> : null}
              </View>
              <Text className='sd-phone'>{stu.phone || '未填手机号'}</Text>
            </View>
          </View>
          <View className='sd-stats'>
            <View className='sd-stat'>
              <Text className='sd-stat-label'>剩余课时</Text>
              <View className='sd-stat-val'>
                <Text className={`sd-hours ${low ? 'low' : ''}`}>{balance ?? '…'}</Text>
                <Text className='sd-hours-unit'>次</Text>
              </View>
            </View>
            <View className='sd-stat'>
              <Text className='sd-stat-label'>邀请码</Text>
              <Text className='sd-invite'>{inviteCode || '未生成'}</Text>
            </View>
          </View>
        </View>

        <Text className='sd-section'>家长绑定</Text>
        <View className='sd-invite-ops'>
          <Text className='sd-iop primary' onClick={onGenerate}>
            {inviteCode ? '重新生成' : '生成邀请码'}
          </Text>
          {inviteCode ? (
            <Text className='sd-iop danger' onClick={onDisableInvite}>
              作废
            </Text>
          ) : null}
        </View>
        {guardians.length === 0 ? (
          <Text className='sd-guardian-empty'>暂无家长绑定。把邀请码给家长，让他在家长端输入即可绑定。</Text>
        ) : (
          guardians.map((g) => (
            <View key={g._id} className='sd-guardian'>
              <Text className='sd-guardian-name'>
                家长{g.relation ? ` · ${g.relation}` : ''} · …{g.guardianOpenid.slice(-6)}
              </Text>
              <Text className='sd-guardian-unbind' onClick={() => onUnbind(g)}>
                解绑
              </Text>
            </View>
          ))
        )}

        <Text className='sd-section'>上课记录</Text>
        {history.length === 0 ? (
          <View className='sd-empty'>
            <Text className='cav sd-empty-en'>no records yet</Text>
            <Text className='sd-empty-cn'>还没有上课记录</Text>
          </View>
        ) : (
          history.map((s) => {
            const ts = new Date(s.startTime).getTime()
            return (
              <View key={s._id} className='sd-rec'>
                <StatusMark status={s.status as SessionStatus} size={34} />
                <Text className='sd-rec-title'>
                  {bjDateStr(ts).slice(5)} {bjTimeStr(ts)} · {courseTypeLabel(s)}
                  {s.mine === false && s.teacherName ? (
                    <Text className='sd-rec-teacher'> · {s.teacherName}老师</Text>
                  ) : null}
                </Text>
                <Text className='sd-rec-status' style={{ color: `var(--status-${s.status})` }}>
                  {STATUS_LABEL[s.status] || s.status}
                </Text>
              </View>
            )
          })
        )}

        <View className='sd-actions'>
          <View className='sd-btn primary' onClick={() => setShowRecharge(true)}>
            <SketchFrame color='#20180E' opacity={0.5} sw={1.6} />
            <Text className='sd-btn-txt on-dark'>充值</Text>
          </View>
          <View className='sd-btn secondary' onClick={() => setShowEdit(true)}>
            <Text className='sd-btn-txt'>编辑</Text>
          </View>
          {stu.isDeleted ? (
            <View className='sd-btn secondary' onClick={onReactivate}>
              <Text className='sd-btn-txt'>恢复</Text>
            </View>
          ) : (
            <View className='sd-btn danger' onClick={onDelete}>
              <Text className='sd-btn-txt on-danger'>删除</Text>
            </View>
          )}
        </View>
      </View>

      <SheetModal visible={showEdit} onClose={() => setShowEdit(false)} title='编辑学员'>
        <StudentForm
          id={id}
          onSaved={() => {
            setShowEdit(false)
            load()
          }}
        />
      </SheetModal>
      <SheetModal visible={showRecharge} onClose={() => setShowRecharge(false)} title='课时充值'>
        <RechargeForm
          studentId={id}
          onDone={() => {
            setShowRecharge(false)
            load()
          }}
        />
      </SheetModal>

      <PaperToastHost />
    </View>
  )
}
