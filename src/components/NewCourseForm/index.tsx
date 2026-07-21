import { useState, useEffect } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { SketchFrame } from '../sketch'
import { listStudents, Student } from '../../services/students'
import { createSession } from '../../services/sessions'
import { ApiError } from '../../services/api'
import { CourseType, COURSE_TYPE_DEFAULT_DURATION } from '../../constants'
import { bjDateStr, bjTimeStr } from '../../utils/datetime'
import './index.scss'

const TYPES = [
  { key: CourseType.Makeup, name: '补课', dur: COURSE_TYPE_DEFAULT_DURATION[CourseType.Makeup], sk: 'sk-1' },
  { key: CourseType.Cambridge, name: '剑桥课程', dur: COURSE_TYPE_DEFAULT_DURATION[CourseType.Cambridge], sk: 'sk-2' }
]
const COURSE_LABEL: Record<string, string> = { makeup: '补课', cambridge: '剑桥课程' }

/** 新建课程表单（用于底部抽屉）。创建成功回调 onCreated */
export default function NewCourseForm({ onCreated }: { onCreated: () => void }) {
  const [students, setStudents] = useState<Student[]>([])
  const [courseType, setCourseType] = useState<string>('')
  const [durationMin, setDurationMin] = useState('')
  const [date, setDate] = useState(bjDateStr(Date.now()))
  const [time, setTime] = useState('15:00')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listStudents()
      .then(({ list }) => setStudents(list))
      .catch(() => {})
  }, [])

  function pickType(t: string, dur: number) {
    setCourseType(t)
    setDurationMin(String(dur))
  }

  function toggle(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  async function doCreate(force: boolean) {
    setSaving(true)
    try {
      const startTime = `${date}T${time}:00+08:00`
      await createSession({ courseType, startTime, durationMin: Number(durationMin), studentIds: selectedIds, force })
      Taro.showToast({ title: '已创建', icon: 'success' })
      onCreated()
    } catch (e) {
      const err = e as ApiError
      if (err.code === 40901 && !force) {
        const conflicts = ((err.data as { conflicts?: any[] })?.conflicts || []) as any[]
        const content =
          conflicts
            .map((c) => {
              const s = new Date(c.startTime).getTime()
              return `${bjTimeStr(s)}–${bjTimeStr(s + c.durationMin * 60000)} ${COURSE_LABEL[c.courseType] || c.courseType}`
            })
            .join('\n') || '与已有课程时间冲突'
        Taro.showModal({
          title: '时段冲突',
          content,
          confirmText: '仍要创建',
          cancelText: '取消',
          success: (r) => {
            if (r.confirm) doCreate(true)
          }
        })
      } else {
        Taro.showToast({ title: err.message || '创建失败', icon: 'none' })
      }
    } finally {
      setSaving(false)
    }
  }

  function submit() {
    if (!courseType) return Taro.showToast({ title: '请选择课程类型', icon: 'none' })
    if (!selectedIds.length) return Taro.showToast({ title: '请至少选择一名学员', icon: 'none' })
    if (!date || !time) return Taro.showToast({ title: '请选择日期和时间', icon: 'none' })
    if (!Number(durationMin) || Number(durationMin) <= 0) {
      return Taro.showToast({ title: '时长无效', icon: 'none' })
    }
    doCreate(false)
  }

  return (
    <View className='ncf'>
      <View className='sec'>
        <Text className='sec-label'>课程类型</Text>
        <View className='type-row'>
          {TYPES.map((t) => (
            <View
              key={t.key}
              className={`type-chip paper-card ${t.sk} ${courseType === t.key ? 'on' : ''}`}
              onClick={() => pickType(t.key, t.dur)}
            >
              <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
              <Text className='type-name'>{t.name}</Text>
              <Text className='type-dur'>{t.dur} 分钟</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='sec'>
        <Text className='sec-label'>
          选择学员<Text className='sec-hint'> · 可多选（小班课）</Text>
        </Text>
        <View className='stu-wrap'>
          {students.length === 0 ? (
            <Text className='stu-empty'>还没有学员，先去「学员」建档</Text>
          ) : (
            students.map((s) => (
              <View
                key={s._id}
                className={`stu-chip ${selectedIds.includes(s._id) ? 'on' : ''}`}
                onClick={() => toggle(s._id)}
              >
                {s.name}
              </View>
            ))
          )}
        </View>
        {selectedIds.length ? <Text className='sel-count'>已选 {selectedIds.length} 人</Text> : null}
      </View>

      <View className='sec sec-row'>
        <Text className='sec-label'>日期</Text>
        <Picker mode='date' value={date} onChange={(e) => setDate(e.detail.value)}>
          <Text className='pick-val'>{date || '选择日期'}</Text>
        </Picker>
      </View>

      <View className='sec sec-row'>
        <Text className='sec-label'>开始时间</Text>
        <Picker mode='time' value={time} onChange={(e) => setTime(e.detail.value)}>
          <Text className='pick-val'>{time || '选择时间'}</Text>
        </Picker>
      </View>

      <View className='sec sec-row'>
        <Text className='sec-label'>时长</Text>
        <View className='dur-box'>
          <Input
            className='dur-input'
            type='number'
            value={durationMin}
            onInput={(e) => setDurationMin(e.detail.value)}
            placeholder='90'
          />
          <Text className='dur-unit'>分钟</Text>
        </View>
      </View>

      <View className='nc-submit' onClick={saving ? undefined : submit}>
        <SketchFrame color='#20180E' opacity={0.5} sw={1.6} />
        <Text className='nc-submit-txt'>{saving ? '创建中…' : '创建课程'}</Text>
      </View>
    </View>
  )
}
