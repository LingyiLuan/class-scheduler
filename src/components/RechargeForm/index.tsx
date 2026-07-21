import { useState, useEffect } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { SketchFrame } from '../sketch'
import { listStudents, getStudent, getBalance, Student } from '../../services/students'
import { createPackage } from '../../services/packages'
import './index.scss'

const QUICK = [10, 20, 30]

/** 课时充值表单（用于底部抽屉）。传 studentId 锁定学员，否则内部选择。完成回调 onDone */
export default function RechargeForm({ studentId, onDone }: { studentId?: string; onDone: () => void }) {
  const [students, setStudents] = useState<Student[]>([])
  const [sid, setSid] = useState('')
  const [sname, setSname] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [count, setCount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (studentId) {
      getStudent(studentId)
        .then((s) => select(s._id, s.name))
        .catch(() => {})
    } else {
      listStudents()
        .then(({ list }) => setStudents(list))
        .catch(() => {})
    }
  }, [studentId])

  async function select(id: string, name: string) {
    setSid(id)
    setSname(name)
    setBalance(null)
    try {
      const b = await getBalance(id, { silent: true })
      setBalance(b.balance)
    } catch {
      // ignore
    }
  }

  async function submit() {
    if (!sid) {
      Taro.showToast({ title: '请先选择学员', icon: 'none' })
      return
    }
    const n = Number(count)
    if (!Number.isInteger(n) || n <= 0) {
      Taro.showToast({ title: '充值次数必须为正整数', icon: 'none' })
      return
    }
    setSaving(true)
    const before = balance ?? 0
    try {
      await createPackage({ studentId: sid, totalCredits: n, note })
      const b = await getBalance(sid, { silent: true })
      Taro.showModal({
        title: '充值成功',
        content: `剩余课时：${before} → ${b.balance} 次`,
        showCancel: false,
        success: () => onDone()
      })
    } catch {
      // api 层已 toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='rform'>
      <View className='rf-row'>
        <Text className='rf-label'>学员</Text>
        {studentId ? (
          <Text className='rf-val'>{sname || '…'}</Text>
        ) : (
          <Picker
            mode='selector'
            range={students.map((s) => s.name)}
            onChange={(e) => {
              const s = students[Number(e.detail.value)]
              if (s) select(s._id, s.name)
            }}
          >
            <Text className='rf-val rf-pick'>{sname || '请选择学员'}</Text>
          </Picker>
        )}
      </View>

      {sid ? (
        <View className='rf-row'>
          <Text className='rf-label'>当前剩余</Text>
          <Text className='rf-val rf-bal'>{balance ?? '…'} 次</Text>
        </View>
      ) : null}

      <View className='rf-col'>
        <Text className='rf-label'>充值次数</Text>
        <Input
          className='rf-num'
          type='number'
          value={count}
          onInput={(e) => setCount(e.detail.value)}
          placeholder='请输入正整数'
        />
        <View className='rf-quick'>
          {QUICK.map((q) => (
            <View key={q} className='rf-qchip' onClick={() => setCount(String(q))}>
              {q}
            </View>
          ))}
        </View>
      </View>

      <View className='rf-col'>
        <Text className='rf-label'>备注（选填）</Text>
        <Input
          className='rf-note'
          value={note}
          onInput={(e) => setNote(e.detail.value)}
          placeholder='如 现金 / 微信收款'
        />
      </View>

      <View className='rf-submit' onClick={saving ? undefined : submit}>
        <SketchFrame color='#20180E' opacity={0.5} sw={1.6} />
        <Text className='rf-submit-txt'>{saving ? '充值中…' : '确认充值'}</Text>
      </View>
    </View>
  )
}
