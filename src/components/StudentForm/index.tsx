import { useState, useEffect } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { SketchFrame } from '../sketch'
import { getStudent, createStudent, updateStudent } from '../../services/students'
import './index.scss'

// placeholder 用次要字号+浅色，不与输入值同级
const PH = 'font-size:26rpx;color:#B5A88C'

/** 学员新增/编辑表单（用于底部抽屉）。传 id 为编辑。保存成功回调 onSaved */
export default function StudentForm({ id, onSaved }: { id?: string; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [levelTag, setLevelTag] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
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
  }, [id])

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
      onSaved()
    } catch {
      // api 层已 toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='sform'>
      <View className='sf-row'>
        <Text className='sf-label'>姓名 *</Text>
        <Input
          className='sf-input'
          value={name}
          onInput={(e) => setName(e.detail.value)}
          placeholder='学员姓名'
          placeholderStyle={PH}
        />
      </View>
      <View className='sf-row'>
        <Text className='sf-label'>手机号</Text>
        <Input
          className='sf-input'
          type='number'
          value={phone}
          onInput={(e) => setPhone(e.detail.value)}
          placeholder='选填'
          placeholderStyle={PH}
        />
      </View>
      <View className='sf-row'>
        <Text className='sf-label'>级别标签</Text>
        <Input
          className='sf-input'
          value={levelTag}
          onInput={(e) => setLevelTag(e.detail.value)}
          placeholder='如 剑桥KET'
          placeholderStyle={PH}
        />
      </View>
      <View className='sf-col'>
        <Text className='sf-label'>备注</Text>
        <Textarea
          className='sf-textarea'
          value={note}
          onInput={(e) => setNote(e.detail.value)}
          placeholder='选填，如家长联系方式、学习目标'
          placeholderStyle={PH}
        />
      </View>

      <View className='sf-submit' onClick={saving ? undefined : submit}>
        <SketchFrame color='#20180E' opacity={0.5} sw={1.6} />
        <Text className='sf-submit-txt'>{saving ? '保存中…' : '保存'}</Text>
      </View>
    </View>
  )
}
