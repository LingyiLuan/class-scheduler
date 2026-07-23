import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { listStudents, getBalances, reactivateStudent, Student } from '../../../services/students'
import { ensureQuota } from '../../../services/subscribe'
import { SketchFrame, StatusMark } from '../../../components/sketch'
import TabBar from '../../../components/TabBar'
import SheetModal from '../../../components/SheetModal'
import StudentForm from '../../../components/StudentForm'
import { PaperToastHost, showPaperToast } from '../../../components/PaperToast'
import { bjDateStr } from '../../../utils/datetime'
import { perfStart } from '../../../utils/perf'
import './index.scss'

interface Row extends Student {
  balance?: number
}

const SK = ['sk-1', 'sk-2', 'sk-3', 'sk-4']

export default function StudentList() {
  const [rows, setRows] = useState<Row[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<'active' | 'inactive'>('active')
  const [inactiveCount, setInactiveCount] = useState(0)

  useDidShow(() => {
    load(filter)
  })

  async function load(f: 'active' | 'inactive') {
    const p = perfStart('students.list')
    try {
      const { list, inactiveCount: ic } = await listStudents(f)
      setInactiveCount(ic ?? 0)
      p.lap(`listStudents(${list.length})`)
      setRows(list)
      // 停用视图不显示余额（改显停用时间）；在读视图才批量取余额
      if (f === 'active') {
        let withBalance: Row[] = list
        try {
          const { balances } = await getBalances(list.map((s) => s._id))
          withBalance = list.map((s) => ({ ...s, balance: balances[s._id] ?? 0 }))
        } catch {
          withBalance = list.map((s) => ({ ...s, balance: NaN }))
        }
        p.lap(`balances(${list.length})`)
        setRows(withBalance)
      }
    } catch {
      // api 层已 toast
    } finally {
      p.end()
      setLoaded(true)
    }
  }

  function switchFilter(f: 'active' | 'inactive') {
    if (f === filter) return
    setFilter(f)
    setLoaded(false)
    load(f)
  }

  async function onReactivate(id: string, e: { stopPropagation: () => void }) {
    e.stopPropagation()
    try {
      await reactivateStudent(id)
      showPaperToast(['已恢复，回到在读列表'])
      if (inactiveCount - 1 <= 0) {
        setFilter('active')
        load('active')
      } else {
        load('inactive')
      }
    } catch {
      // api 层已 toast
    }
  }

  const showTabs = inactiveCount > 0 || filter === 'inactive'

  return (
    <View className='sl'>
      <View className='paper-grain' />

      <View className='sl-head'>
        <Text className='sl-title'>学员</Text>
        <View className='sl-add' onClick={() => setShowAdd(true)}>
          <Text className='sl-add-txt'>＋ 新增</Text>
        </View>
      </View>

      {showTabs ? (
        <View className='sl-filter'>
          <Text
            className={`sl-seg ${filter === 'active' ? 'on' : ''}`}
            onClick={() => switchFilter('active')}
          >
            在读
          </Text>
          <Text
            className={`sl-seg ${filter === 'inactive' ? 'on' : ''}`}
            onClick={() => switchFilter('inactive')}
          >
            已停用{inactiveCount > 0 ? ` ${inactiveCount}` : ''}
          </Text>
        </View>
      ) : null}

      <View className='sl-inner'>
        {loaded && rows.length === 0 ? (
          <View className='sl-empty'>
            <Text className='cav sl-empty-en'>{filter === 'inactive' ? 'none' : 'no students yet'}</Text>
            <Text className='sl-empty-cn'>
              {filter === 'inactive' ? '没有已停用的学员' : '还没有学员，点右上「新增」建档'}
            </Text>
          </View>
        ) : (
          rows.map((s, i) => {
            const inactive = filter === 'inactive'
            const known = !Number.isNaN(s.balance as number)
            const low = known && (s.balance as number) <= 2
            return (
              <View
                key={s._id}
                className={`sl-card paper-card ${SK[i % SK.length]} ${inactive ? 'inactive' : ''}`}
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
                  {inactive ? (
                    <Text className='sl-deact'>
                      已停用{s.deactivatedAt ? ` · ${bjDateStr(new Date(s.deactivatedAt).getTime()).slice(5)}` : ''}
                    </Text>
                  ) : s.phone ? (
                    <Text className='sl-phone'>{s.phone}</Text>
                  ) : null}
                </View>
                {inactive ? (
                  <Text className='sl-restore' onClick={(e) => onReactivate(s._id, e)}>
                    恢复
                  </Text>
                ) : (
                  <View className='sl-hours-wrap'>
                    <View className='sl-num-box'>
                      {low ? <StatusMark status='oval' size={70} className='sl-circle' /> : null}
                      <Text className={`sl-hours ${low ? 'low' : ''}`}>{known ? s.balance : '—'}</Text>
                    </View>
                    <Text className='sl-hours-unit'>次</Text>
                  </View>
                )}
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
            load(filter)
          }}
        />
      </SheetModal>

      <PaperToastHost />
    </View>
  )
}
