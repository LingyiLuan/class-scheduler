import { useState } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { Button } from '@nutui/nutui-react-taro'
import { listStudents, getStudent, getBalance, Student } from '../../services/students'
import { createPackage } from '../../services/packages'
import './index.scss'

const QUICK = [10, 20, 30]

export default function Recharge() {
  const router = useRouter()
  const lockedId = router.params.studentId

  const [students, setStudents] = useState<Student[]>([])
  const [studentId, setStudentId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [count, setCount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useLoad(() => {
    if (lockedId) {
      getStudent(lockedId)
        .then((s) => selectStudent(s._id, s.name))
        .catch(() => {})
    } else {
      listStudents()
        .then(({ list }) => setStudents(list))
        .catch(() => {})
    }
  })

  async function selectStudent(id: string, name: string) {
    setStudentId(id)
    setStudentName(name)
    setBalance(null)
    try {
      const b = await getBalance(id, { silent: true })
      setBalance(b.balance)
    } catch {
      // ignore
    }
  }

  async function submit() {
    if (!studentId) {
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
      await createPackage({ studentId, totalCredits: n, note })
      const b = await getBalance(studentId, { silent: true })
      setBalance(b.balance)
      setCount('')
      setNote('')
      Taro.showModal({
        title: '充值成功',
        content: `剩余课时：${before} → ${b.balance} 次`,
        showCancel: false
      })
    } catch {
      // api 层已 toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='recharge'>
      <View className='field'>
        <Text className='label'>学员</Text>
        {lockedId ? (
          <Text className='value'>{studentName || '…'}</Text>
        ) : (
          <Picker
            mode='selector'
            range={students.map((s) => s.name)}
            onChange={(e) => {
              const s = students[Number(e.detail.value)]
              if (s) selectStudent(s._id, s.name)
            }}
          >
            <Text className='value picker'>{studentName || '请选择学员'}</Text>
          </Picker>
        )}
      </View>

      {studentId ? (
        <View className='field'>
          <Text className='label'>当前剩余课时</Text>
          <Text className='value bal'>{balance ?? '…'} 次</Text>
        </View>
      ) : null}

      <View className='field'>
        <Text className='label'>充值次数</Text>
        <Input
          className='value'
          type='number'
          value={count}
          onInput={(e) => setCount(e.detail.value)}
          placeholder='请输入正整数'
        />
        <View className='quick'>
          {QUICK.map((q) => (
            <Button key={q} size='small' onClick={() => setCount(String(q))}>
              {q}
            </Button>
          ))}
        </View>
      </View>

      <View className='field'>
        <Text className='label'>备注（选填）</Text>
        <Input
          className='value'
          value={note}
          onInput={(e) => setNote(e.detail.value)}
          placeholder='如 现金/微信收款'
        />
      </View>

      <View className='submit'>
        <Button type='primary' block loading={saving} onClick={submit}>
          确认充值
        </Button>
      </View>
    </View>
  )
}
