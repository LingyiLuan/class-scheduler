import { useState } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { SketchFrame } from '../sketch'
import { updateSession, SessionRow } from '../../services/sessions'
import { ApiError } from '../../services/api'
import { courseTypeLabel } from '../../utils/courseType'
import { bjDateStr, bjTimeStr } from '../../utils/datetime'
import { showPaperToast } from '../PaperToast'
import './index.scss'

const PH = 'font-size:26rpx;color:#B5A88C'

/** 改期表单（底部抽屉）。改这一节的日期/开始时间/时长/备注，不动循环规则、不改 ownerId */
export default function RescheduleForm({ session, onDone }: { session: SessionRow; onDone: () => void }) {
  const ts = new Date(session.startTime).getTime()
  const [date, setDate] = useState(bjDateStr(ts))
  const [time, setTime] = useState(bjTimeStr(ts))
  const [durationMin, setDurationMin] = useState(String(session.durationMin))
  const [note, setNote] = useState(session.note || '')
  const [saving, setSaving] = useState(false)

  async function doUpdate(force: boolean) {
    setSaving(true)
    try {
      await updateSession(session._id, {
        startTime: `${date}T${time}:00+08:00`,
        durationMin: Number(durationMin),
        note,
        force
      })
      showPaperToast(['已改期'])
      onDone()
    } catch (e) {
      const err = e as ApiError
      if (err.code === 40901 && !force) {
        const conflicts = ((err.data as { conflicts?: any[] })?.conflicts || []) as any[]
        const content =
          conflicts
            .map((c) => {
              const s = new Date(c.startTime).getTime()
              return `${bjTimeStr(s)}–${bjTimeStr(s + c.durationMin * 60000)} ${courseTypeLabel(c)}`
            })
            .join('\n') || '与已有课程时间冲突'
        Taro.showModal({
          title: '时段冲突',
          content,
          confirmText: '仍要改期',
          cancelText: '取消',
          success: (r) => {
            if (r.confirm) doUpdate(true)
          }
        })
      } else if (err.code === 40902) {
        Taro.showModal({ title: '无法改期', content: err.message, showCancel: false })
      } else {
        Taro.showToast({ title: err.message || '改期失败', icon: 'none' })
      }
    } finally {
      setSaving(false)
    }
  }

  function submit() {
    if (!date || !time) return Taro.showToast({ title: '请选择日期和时间', icon: 'none' })
    if (!Number(durationMin) || Number(durationMin) <= 0) return Taro.showToast({ title: '时长无效', icon: 'none' })
    const newTs = new Date(`${date}T${time}:00+08:00`).getTime()
    if (newTs < Date.now()) {
      Taro.showModal({
        title: '改到过去的时间',
        content: '该时间已过。用于补录临时调整过的课？',
        confirmText: '确认',
        success: (r) => {
          if (r.confirm) doUpdate(false)
        }
      })
      return
    }
    doUpdate(false)
  }

  return (
    <View className='rsf'>
      <View className='rsf-row'>
        <Text className='rsf-label'>日期</Text>
        <Picker mode='date' value={date} onChange={(e) => setDate(e.detail.value)}>
          <Text className='rsf-val'>{date || '选择日期'}</Text>
        </Picker>
      </View>
      <View className='rsf-row'>
        <Text className='rsf-label'>开始时间</Text>
        <Picker mode='time' value={time} onChange={(e) => setTime(e.detail.value)}>
          <Text className='rsf-val'>{time || '选择时间'}</Text>
        </Picker>
      </View>
      <View className='rsf-row'>
        <Text className='rsf-label'>时长(分钟)</Text>
        <Input
          className='rsf-input'
          type='number'
          value={durationMin}
          onInput={(e) => setDurationMin(e.detail.value)}
          placeholderStyle={PH}
        />
      </View>
      <View className='rsf-col'>
        <Text className='rsf-label'>备注（选填）</Text>
        <Input
          className='rsf-note'
          value={note}
          onInput={(e) => setNote(e.detail.value)}
          placeholder='如 调课原因'
          placeholderStyle={PH}
        />
      </View>

      <View className='rsf-submit' onClick={saving ? undefined : submit}>
        <SketchFrame color='#20180E' opacity={0.5} sw={1.6} />
        <Text className='rsf-submit-txt'>{saving ? '保存中…' : '确认改期'}</Text>
      </View>
    </View>
  )
}
