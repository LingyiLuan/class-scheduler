import { useState, useEffect } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { SketchFrame } from '../sketch'
import { listStudents, Student } from '../../services/students'
import { createSession } from '../../services/sessions'
import { createRecurrence } from '../../services/recurrences'
import { ApiError } from '../../services/api'
import { requestSubscribe } from '../../services/subscribe'
import { TMPL_CLASS_REMINDER } from '../../constants/subscribe'
import { CourseType, COURSE_TYPE_DEFAULT_DURATION } from '../../constants'
import { bjDateStr, bjTimeStr } from '../../utils/datetime'
import { showPaperToast } from '../PaperToast'
import './index.scss'

const TYPES = [
  { key: CourseType.Makeup, name: '补课', dur: COURSE_TYPE_DEFAULT_DURATION[CourseType.Makeup], sk: 'sk-1' },
  { key: CourseType.Cambridge, name: '剑桥课程', dur: COURSE_TYPE_DEFAULT_DURATION[CourseType.Cambridge], sk: 'sk-2' }
]
const COURSE_LABEL: Record<string, string> = { makeup: '补课', cambridge: '剑桥课程' }
// 周一优先展示；wd 用 0=周日..6=周六
const WEEKDAYS = [
  { label: '一', wd: 1 },
  { label: '二', wd: 2 },
  { label: '三', wd: 3 },
  { label: '四', wd: 4 },
  { label: '五', wd: 5 },
  { label: '六', wd: 6 },
  { label: '日', wd: 0 }
]
const PH = 'font-size:26rpx;color:#B5A88C'
const DAY = 86400000

function countOccurrences(startDate: string, endDate: string, weekdays: number[]): number {
  if (!startDate || !endDate || !weekdays.length || endDate < startDate) return 0
  const wd = new Set(weekdays)
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const startTs = Date.UTC(sy, sm - 1, sd)
  let endTs = Date.UTC(ey, em - 1, ed)
  const cap = startTs + 26 * 7 * DAY
  if (endTs > cap) endTs = cap
  let n = 0
  for (let ts = startTs; ts <= endTs; ts += DAY) {
    if (wd.has(new Date(ts).getUTCDay())) n += 1
    if (n > 400) break
  }
  return n
}

/** 新建课程表单（用于底部抽屉）。支持单次课与循环课。创建成功回调 onCreated */
export default function NewCourseForm({ onCreated }: { onCreated: () => void }) {
  const [students, setStudents] = useState<Student[]>([])
  const [mode, setMode] = useState<'single' | 'recurring'>('single')
  const [courseType, setCourseType] = useState<string>('')
  const [durationMin, setDurationMin] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [time, setTime] = useState('15:00')
  // 单次
  const [date, setDate] = useState(bjDateStr(Date.now()))
  // 循环
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [startDate, setStartDate] = useState(bjDateStr(Date.now()))
  const [endDate, setEndDate] = useState(bjDateStr(Date.now() + 56 * DAY))
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
  function toggleStu(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }
  function toggleWd(wd: number) {
    setWeekdays((ws) => (ws.includes(wd) ? ws.filter((x) => x !== wd) : [...ws, wd]))
  }

  const preview = mode === 'recurring' ? countOccurrences(startDate, endDate, weekdays) : 0

  // ── 单次 ──
  async function doCreateSingle(force: boolean) {
    setSaving(true)
    try {
      await createSession({
        courseType,
        startTime: `${date}T${time}:00+08:00`,
        durationMin: Number(durationMin),
        studentIds: selectedIds,
        force
      })
      showPaperToast(['课程已创建'])
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
            if (r.confirm) doCreateSingle(true)
          }
        })
      } else if (err.code === 40902) {
        Taro.showModal({ title: '无法排课', content: err.message, showCancel: false })
      } else {
        Taro.showToast({ title: err.message || '创建失败', icon: 'none' })
      }
    } finally {
      setSaving(false)
    }
  }

  // ── 循环 ──
  async function doCreateRecurring(m: 'auto' | 'skip' | 'force') {
    setSaving(true)
    try {
      const r = await createRecurrence({
        courseType,
        weekdays,
        timeOfDay: time,
        durationMin: Number(durationMin),
        studentIds: selectedIds,
        startDate,
        endDate,
        mode: m
      })
      showPaperToast([
        `已生成 ${r.generated} 节课${r.skipped ? `，跳过 ${r.skipped} 节冲突` : ''}`,
        '提醒额度有限，将优先提醒最近的课程'
      ])
      onCreated()
    } catch (e) {
      const err = e as ApiError
      if (err.code === 40901 && m === 'auto') {
        const d = (err.data || {}) as { conflicts?: any[]; conflictCount?: number }
        const conflicts = d.conflicts || []
        const lines = conflicts.slice(0, 8).map((c) => {
          const s = new Date(c.startTime).getTime()
          return `${bjDateStr(s).slice(5)} ${bjTimeStr(s)}`
        })
        const more = conflicts.length > 8 ? `\n…共 ${conflicts.length} 节冲突` : ''
        Taro.showModal({
          title: `${d.conflictCount} 节与已有课冲突`,
          content: lines.join('\n') + more,
          confirmText: '全部生成',
          cancelText: '跳过冲突',
          success: (r) => {
            doCreateRecurring(r.confirm ? 'force' : 'skip')
          }
        })
      } else if (err.code === 40902) {
        const d = (err.data || {}) as { conflicts?: any[] }
        const list = d.conflicts || []
        const lines = list.slice(0, 8).map((c) => {
          const s = new Date(c.startTime).getTime()
          return `${bjDateStr(s).slice(5)} ${bjTimeStr(s)}`
        })
        const more = list.length > 8 ? `\n…共 ${list.length} 节` : ''
        Taro.showModal({
          title: '存在学员重复排课',
          content: `${err.message}\n${lines.join('\n')}${more}\n请调整循环规则`,
          showCancel: false
        })
      } else {
        Taro.showToast({ title: err.message || '生成失败', icon: 'none' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (!courseType) return Taro.showToast({ title: '请选择课程类型', icon: 'none' })
    if (!selectedIds.length) return Taro.showToast({ title: '请至少选择一名学员', icon: 'none' })
    if (!Number(durationMin) || Number(durationMin) <= 0) return Taro.showToast({ title: '时长无效', icon: 'none' })
    if (mode === 'single') {
      if (!date || !time) return Taro.showToast({ title: '请选择日期和时间', icon: 'none' })
      // 在点击手势内请求课前提醒授权（微信要求 tap 内调用），再创建
      await requestSubscribe([TMPL_CLASS_REMINDER])
      doCreateSingle(false)
    } else {
      if (!weekdays.length) return Taro.showToast({ title: '请选择星期', icon: 'none' })
      if (!startDate || !endDate) return Taro.showToast({ title: '请选择开始与结束日期', icon: 'none' })
      if (endDate < startDate) return Taro.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
      if (!preview) return Taro.showToast({ title: '所选范围内没有课', icon: 'none' })
      await requestSubscribe([TMPL_CLASS_REMINDER])
      doCreateRecurring('auto')
    }
  }

  return (
    <View className='ncf'>
      <View className='mode-row'>
        <View className={`mode-chip ${mode === 'single' ? 'on' : ''}`} onClick={() => setMode('single')}>
          单次课
        </View>
        <View className={`mode-chip ${mode === 'recurring' ? 'on' : ''}`} onClick={() => setMode('recurring')}>
          循环课
        </View>
      </View>

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
                onClick={() => toggleStu(s._id)}
              >
                {s.name}
              </View>
            ))
          )}
        </View>
        {selectedIds.length ? <Text className='sel-count'>已选 {selectedIds.length} 人</Text> : null}
      </View>

      {mode === 'recurring' ? (
        <View className='sec'>
          <Text className='sec-label'>
            星期<Text className='sec-hint'> · 可多选（如每周二、四）</Text>
          </Text>
          <View className='wd-wrap'>
            {WEEKDAYS.map((w) => (
              <View
                key={w.wd}
                className={`wd-chip ${weekdays.includes(w.wd) ? 'on' : ''}`}
                onClick={() => toggleWd(w.wd)}
              >
                {w.label}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {mode === 'single' ? (
        <View className='sec sec-row'>
          <Text className='sec-label'>日期</Text>
          <Picker mode='date' value={date} onChange={(e) => setDate(e.detail.value)}>
            <Text className='pick-val'>{date || '选择日期'}</Text>
          </Picker>
        </View>
      ) : (
        <>
          <View className='sec sec-row'>
            <Text className='sec-label'>开始日期</Text>
            <Picker mode='date' value={startDate} onChange={(e) => setStartDate(e.detail.value)}>
              <Text className='pick-val'>{startDate}</Text>
            </Picker>
          </View>
          <View className='sec sec-row'>
            <Text className='sec-label'>结束日期</Text>
            <Picker mode='date' value={endDate} onChange={(e) => setEndDate(e.detail.value)}>
              <Text className='pick-val'>{endDate}</Text>
            </Picker>
          </View>
        </>
      )}

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
            placeholderStyle={PH}
          />
          <Text className='dur-unit'>分钟</Text>
        </View>
      </View>

      {mode === 'recurring' && preview > 0 ? (
        <View className='preview'>
          <Text className='preview-txt'>将生成 {preview} 节课</Text>
        </View>
      ) : null}

      <View className='nc-submit' onClick={saving ? undefined : submit}>
        <SketchFrame color='#20180E' opacity={0.5} sw={1.6} />
        <Text className='nc-submit-txt'>
          {saving ? '处理中…' : mode === 'single' ? '创建课程' : `生成 ${preview} 节课`}
        </Text>
      </View>
    </View>
  )
}
