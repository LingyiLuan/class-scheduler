import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Cell, Empty } from '@nutui/nutui-react-taro'
import { listStudents, getBalance, Student } from '../../../services/students'
import TabBar from '../../../components/TabBar'
import SheetModal from '../../../components/SheetModal'
import StudentForm from '../../../components/StudentForm'
import './index.scss'

interface Row extends Student {
  balance?: number
}

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
    <View className='stu-list'>
      <View className='toolbar'>
        <Button type='primary' size='small' onClick={() => setShowAdd(true)}>
          新增学员
        </Button>
      </View>

      {loaded && rows.length === 0 ? (
        <Empty description='暂无学员，点右上「新增学员」建档' />
      ) : (
        rows.map((s) => (
          <Cell
            key={s._id}
            title={s.name}
            description={s.levelTag || ''}
            extra={<Text className='bal'>剩余 {Number.isNaN(s.balance as number) ? '—' : s.balance ?? '…'} 次</Text>}
            onClick={() => Taro.navigateTo({ url: `/pages/students/detail/index?id=${s._id}` })}
          />
        ))
      )}

      <TabBar current='students' />

      <SheetModal visible={showAdd} onClose={() => setShowAdd(false)} title='新增学员'>
        <StudentForm
          onSaved={() => {
            setShowAdd(false)
            load()
          }}
        />
      </SheetModal>
    </View>
  )
}
