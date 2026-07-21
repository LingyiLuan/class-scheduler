import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { listStudents, getBalance, Student } from '../../../services/students'
import { ensureQuota } from '../../../services/subscribe'
import { SketchFrame, StatusMark } from '../../../components/sketch'
import TabBar from '../../../components/TabBar'
import SheetModal from '../../../components/SheetModal'
import StudentForm from '../../../components/StudentForm'
import { PaperToastHost } from '../../../components/PaperToast'
import './index.scss'

interface Row extends Student {
  balance?: number
}

const SK = ['sk-1', 'sk-2', 'sk-3', 'sk-4']

export default function StudentList() {
  const [rows, setRows] = useState<Row[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  useDidShow(() => {
    load()
  })

  async function load() {
    try {
      const { list } = await listStudents()
      setRows(list)
      const withBalance = await Promise.all(
        list.map(async (s) => {
          try {
            const r = await getBalance(s._id, { silent: true })
            return { ...s, balance: r.balance }
          } catch {
            return { ...s, balance: NaN }
          }
        })
      )
      setRows(withBalance)
    } catch {
      // api 层已 toast
    } finally {
      setLoaded(true)
    }
  }

  return (
    <View className='sl'>
      <View className='paper-grain' />

      <View className='sl-head'>
        <Text className='sl-title'>学员</Text>
        <View className='sl-add' onClick={() => setShowAdd(true)}>
          <Text className='sl-add-txt'>＋ 新增</Text>
        </View>
      </View>

      <View className='sl-inner'>
        {loaded && rows.length === 0 ? (
          <View className='sl-empty'>
            <Text className='cav sl-empty-en'>no students yet</Text>
            <Text className='sl-empty-cn'>还没有学员，点右上「新增」建档</Text>
          </View>
        ) : (
          rows.map((s, i) => {
            const known = !Number.isNaN(s.balance as number)
            const low = known && (s.balance as number) <= 2
            return (
              <View
                key={s._id}
                className={`sl-card paper-card ${SK[i % SK.length]}`}
                onClick={() => {
                  ensureQuota()
                  Taro.navigateTo({ url: `/pages/students/detail/index?id=${s._id}` })
                }}
              >
                <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
                <View className='sl-avatar'>{s.name.slice(0, 1)}</View>
                <View className='sl-info'>
                  <View className='sl-nameline'>
                    <Text className='sl-name'>{s.name}</Text>
                    {s.levelTag ? <Text className='sl-level'>{s.levelTag}</Text> : null}
                  </View>
                  {s.phone ? <Text className='sl-phone'>{s.phone}</Text> : null}
                </View>
                <View className='sl-hours-wrap'>
                  <View className='sl-num-box'>
                    {low ? <StatusMark status='oval' size={70} className='sl-circle' /> : null}
                    <Text className={`sl-hours ${low ? 'low' : ''}`}>{known ? s.balance : '—'}</Text>
                  </View>
                  <Text className='sl-hours-unit'>次</Text>
                </View>
              </View>
            )
          })
        )}
      </View>

      <TabBar current='students' />

      <SheetModal visible={showAdd} onClose={() => setShowAdd(false)} title='新增学员'>
        <StudentForm
          onSaved={() => {
            setShowAdd(false)
            load()
          }}
        />
      </SheetModal>

      <PaperToastHost />
    </View>
  )
}
