import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { Button } from '@nutui/nutui-react-taro'
import { getStudent, createStudent, updateStudent } from '../../../services/students'
import './index.scss'

export default function StudentForm() {
  const router = useRouter()
  const id = router.params.id
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [levelTag, setLevelTag] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useLoad(() => {
    Taro.setNavigationBarTitle({ title: id ? '编辑学员' : '新增学员' })
    if (id) {
      getStudent(id)
        .then((s) => {
          setName(s.name || '')
          setPhone(s.phone || '')
          setLevelTag(s.levelTag || '')
          setNote(s.note || '')
        })
        .catch(() => {})
    }
  })

  async function submit() {
    if (!name.trim()) {
      Taro.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const payload = { name: name.trim(), phone, levelTag, note }
      if (id) await updateStudent(id, payload)
      else await createStudent(payload)
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch {
      // api 层已 toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='stu-form'>
      <View className='field'>
        <Text className='label'>姓名 *</Text>
        <Input className='input' value={name} onInput={(e) => setName(e.detail.value)} placeholder='学员姓名' />
      </View>
      <View className='field'>
        <Text className='label'>手机号</Text>
        <Input
          className='input'
          type='number'
          value={phone}
          onInput={(e) => setPhone(e.detail.value)}
          placeholder='选填'
        />
      </View>
      <View className='field'>
        <Text className='label'>级别标签</Text>
        <Input
          className='input'
          value={levelTag}
          onInput={(e) => setLevelTag(e.detail.value)}
          placeholder='如 剑桥KET、启蒙'
        />
      </View>
      <View className='field'>
        <Text className='label'>备注</Text>
        <Textarea
          className='textarea'
          value={note}
          onInput={(e) => setNote(e.detail.value)}
          placeholder='选填'
        />
      </View>
      <View className='submit'>
        <Button type='primary' block loading={saving} onClick={submit}>
          保存
        </Button>
      </View>
    </View>
  )
}
