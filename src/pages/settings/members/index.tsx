import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { SketchFrame } from '../../../components/sketch'
import { PaperToastHost, showPaperToast } from '../../../components/PaperToast'
import { listUsers, setUserActive, setUserRole, setUserName, AdminUser } from '../../../services/users'
import { UserRole } from '../../../constants'
import './index.scss'

const ROLE_LABEL: Record<string, string> = {
  [UserRole.Owner]: '管理员',
  [UserRole.Teacher]: '教师',
  [UserRole.Student]: '学生'
}

export default function Members() {
  const [list, setList] = useState<AdminUser[]>([])
  const [loaded, setLoaded] = useState(false)

  useLoad(() => load())

  async function load() {
    try {
      const { list: l } = await listUsers()
      setList(l)
    } catch {
      // toasted
    } finally {
      setLoaded(true)
    }
  }

  async function onActivate(u: AdminUser, isActive: boolean) {
    try {
      await setUserActive(u._id, isActive)
      showPaperToast([isActive ? '已激活' : '已停用'])
      load()
    } catch (e) {
      Taro.showToast({ title: (e as { message?: string })?.message || '操作失败', icon: 'none' })
    }
  }

  function onRename(u: AdminUser) {
    Taro.showModal({
      title: '设置姓名',
      editable: true,
      content: u.displayName || '',
      placeholderText: '如 Ruby / 王老师',
      confirmText: '保存',
      success: async (r) => {
        const n = (r.confirm && r.content && r.content.trim()) || ''
        if (!n) return
        try {
          await setUserName(u._id, n)
          showPaperToast(['已保存'])
          load()
        } catch (e) {
          Taro.showToast({ title: (e as { message?: string })?.message || '操作失败', icon: 'none' })
        }
      }
    })
  }

  function onSetRole(u: AdminUser) {
    const next = u.role === UserRole.Owner ? UserRole.Teacher : UserRole.Owner
    Taro.showModal({
      title: '修改角色',
      content: `将「${u.displayName || '未填名'}」设为${ROLE_LABEL[next]}？`,
      success: async (r) => {
        if (!r.confirm) return
        try {
          await setUserRole(u._id, next)
          showPaperToast(['已修改'])
          load()
        } catch (e) {
          Taro.showToast({ title: (e as { message?: string })?.message || '操作失败', icon: 'none' })
        }
      }
    })
  }

  const pending = list.filter((u) => !u.isActive)
  const active = list.filter((u) => u.isActive)

  function renderRow(u: AdminUser, sk: string) {
    return (
      <View key={u._id} className={`mb-card paper-card ${sk}`}>
        <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
        <View className='mb-info'>
          <View className='mb-nameline'>
            <Text className='mb-name'>{u.displayName || '未填名'}</Text>
            <Text className='mb-role'>{ROLE_LABEL[u.role] || u.role}</Text>
            {u.self ? <Text className='mb-self'>我</Text> : null}
          </View>
          <Text className='mb-status'>{u.isActive ? '已激活' : '待激活'}</Text>
        </View>
        <View className='mb-ops'>
          <Text className='mb-op' onClick={() => onRename(u)}>
            改名
          </Text>
          {u.self ? (
            <Text className='mb-op muted'>本人</Text>
          ) : u.isActive ? (
            <>
              <Text className='mb-op' onClick={() => onSetRole(u)}>
                {u.role === UserRole.Owner ? '设为教师' : '设为管理员'}
              </Text>
              <Text className='mb-op danger' onClick={() => onActivate(u, false)}>
                停用
              </Text>
            </>
          ) : (
            <Text className='mb-op primary' onClick={() => onActivate(u, true)}>
              激活
            </Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <View className='mb'>
      <View className='paper-grain' />

      <View className='mb-head'>
        <Text className='mb-title'>成员管理</Text>
      </View>

      {loaded && list.length === 0 ? (
        <Text className='mb-empty'>暂无成员</Text>
      ) : (
        <View className='mb-inner'>
          {pending.length ? (
            <>
              <View className='mb-group-head'>
                <Text className='mb-group-title'>待激活</Text>
                <View className='mb-group-rule' />
              </View>
              {pending.map((u, i) => renderRow(u, `sk-${(i % 4) + 1}`))}
            </>
          ) : null}

          <View className='mb-group-head second'>
            <Text className='mb-group-title'>已激活</Text>
            <View className='mb-group-rule' />
          </View>
          {active.map((u, i) => renderRow(u, `sk-${(i % 4) + 1}`))}
        </View>
      )}

      <PaperToastHost />
    </View>
  )
}
