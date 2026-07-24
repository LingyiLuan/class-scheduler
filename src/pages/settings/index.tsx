import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { SketchFrame } from '../../components/sketch'
import { PaperToastHost, showPaperToast } from '../../components/PaperToast'
import {
  listCourseTypes,
  createCourseType,
  updateCourseType,
  setCourseTypeActive,
  removeCourseType,
  reorderCourseTypes,
  migrateCourseTypes,
  CourseType
} from '../../services/courseTypes'
import { getGreeting, setGreeting } from '../../services/config'
import { getCachedLogin } from '../../services/user'
import { UserRole } from '../../constants'
import { ApiError } from '../../services/api'
import './index.scss'

const PH = 'font-size:26rpx;color:#B5A88C'
const SK = ['sk-1', 'sk-2', 'sk-3', 'sk-4']
// 预留的后续设置板块（结构占位，功能陆续加入）
const FUTURE = ['提醒设置', '课时阈值', '联系二维码', '账号信息']

export default function Settings() {
  const [types, setTypes] = useState<CourseType[]>([])
  const [newName, setNewName] = useState('')
  const [newDur, setNewDur] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editName, setEditName] = useState('')
  const [editDur, setEditDur] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [greeting, setGreetingVal] = useState('')
  const isOwner = getCachedLogin()?.role === UserRole.Owner

  useLoad(() => load())

  async function load() {
    try {
      const { list, needsMigration: nm } = await listCourseTypes(false)
      setTypes(list)
      setNeedsMigration(!!nm)
    } catch {
      // toasted
    }
    if (isOwner) {
      try {
        const g = await getGreeting()
        setGreetingVal(g.greeting)
      } catch {
        // ignore
      }
    }
  }

  async function onSaveGreeting() {
    const g = greeting.trim()
    if (!g) return Taro.showToast({ title: '欢迎语不能为空', icon: 'none' })
    setBusy(true)
    try {
      await setGreeting(g)
      showPaperToast(['已保存'])
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  async function onAdd() {
    const name = newName.trim()
    const dur = Number(newDur)
    if (!name) return Taro.showToast({ title: '请填写名称', icon: 'none' })
    if (!Number.isInteger(dur) || dur <= 0) return Taro.showToast({ title: '默认时长无效', icon: 'none' })
    setBusy(true)
    try {
      await createCourseType(name, dur)
      setNewName('')
      setNewDur('')
      showPaperToast(['已添加'])
      await load()
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  function startEdit(t: CourseType) {
    setEditingId(t._id)
    setEditName(t.name)
    setEditDur(String(t.durationMin))
  }

  async function saveEdit(id: string) {
    const name = editName.trim()
    const dur = Number(editDur)
    if (!name) return Taro.showToast({ title: '请填写名称', icon: 'none' })
    if (!Number.isInteger(dur) || dur <= 0) return Taro.showToast({ title: '默认时长无效', icon: 'none' })
    setBusy(true)
    try {
      await updateCourseType(id, { name, durationMin: dur })
      setEditingId('')
      await load()
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(t: CourseType) {
    setBusy(true)
    try {
      await setCourseTypeActive(t._id, !t.isActive)
      await load()
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  function onDelete(t: CourseType) {
    Taro.showModal({
      title: '删除课程类型',
      content: `确定删除「${t.name}」？`,
      confirmText: '删除',
      confirmColor: '#C24A28',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await removeCourseType(t._id)
          showPaperToast(['已删除'])
          await load()
        } catch (e) {
          const err = e as ApiError
          if (err.code === 40002) {
            // 有引用不可硬删，引导改为停用
            Taro.showModal({
              title: '无法删除',
              content: '该类型已被课程使用，历史需要它显示。是否改为「停用」（新建课时不再出现）？',
              confirmText: '停用',
              success: (rr) => {
                if (rr.confirm) toggleActive({ ...t, isActive: true })
              }
            })
          } else {
            Taro.showToast({ title: err.message || '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= types.length) return
    const next = types.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setTypes(next)
    try {
      await reorderCourseTypes(next.map((t) => t._id))
    } catch {
      await load()
    }
  }

  function onMigrate() {
    Taro.showModal({
      title: '迁移历史数据',
      content: '为历史课程回填课程类型引用（仅需执行一次，可重复点击无副作用）。',
      confirmText: '开始',
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await migrateCourseTypes()
          showPaperToast([`迁移完成`, `课程 ${res.migratedSessions} · 循环 ${res.migratedRecurrences}`])
          await load()
        } catch {
          // toasted
        }
      }
    })
  }

  return (
    <View className='settings'>
      <View className='paper-grain' />

      <View className='set-head'>
        <Text className='set-title'>设置</Text>
      </View>

      {isOwner ? (
        <View>
          <View className='group-head'>
            <Text className='group-title'>工作室</Text>
            <View className='group-rule' />
          </View>
          <Text className='group-hint'>主页欢迎语，所有登录者看到的一样</Text>
          <View className='add-card paper-card sk-1'>
            <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
            <View className='fld'>
              <Text className='fld-label'>欢迎语</Text>
              <View className='fld-box'>
                <Input
                  className='fld-input'
                  value={greeting}
                  onInput={(e) => setGreetingVal(e.detail.value)}
                  placeholder='欢迎 Ruby & Yumi 老师'
                  placeholderStyle={PH}
                />
              </View>
            </View>
            <View className='add-actions'>
              <View className={`add-btn ${busy ? 'off' : ''}`} onClick={busy ? undefined : onSaveGreeting}>
                <Text className='add-btn-txt'>保存</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {isOwner ? (
        <View>
          <View className='group-head'>
            <Text className='group-title'>成员</Text>
            <View className='group-rule' />
          </View>
          <View
            className='member-entry paper-card sk-3'
            onClick={() => Taro.navigateTo({ url: '/pages/settings/members/index' })}
          >
            <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
            <Text className='member-entry-txt'>成员管理（激活 / 角色）</Text>
            <Text className='member-entry-arrow'>›</Text>
          </View>
        </View>
      ) : null}

      <View className='group-head'>
        <Text className='group-title'>课程类型</Text>
        <View className='group-rule' />
      </View>
      <Text className='group-hint'>停用后新建课时不再出现，历史课程仍正常显示</Text>

      {/* 新增：两栏各自独立描边，避免填错行 */}
      <View className='add-card paper-card sk-2'>
        <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
        <View className='fld'>
          <Text className='fld-label'>名称</Text>
          <View className='fld-box'>
            <Input
              className='fld-input'
              value={newName}
              onInput={(e) => setNewName(e.detail.value)}
              placeholder='类型名称'
              placeholderStyle={PH}
            />
          </View>
        </View>
        <View className='fld'>
          <Text className='fld-label'>默认时长</Text>
          <View className='fld-box dur'>
            <Input
              className='fld-input'
              type='number'
              value={newDur}
              onInput={(e) => setNewDur(e.detail.value)}
              placeholder='90'
              placeholderStyle={PH}
            />
            <Text className='fld-suffix'>分钟</Text>
          </View>
        </View>
        <View className='add-actions'>
          <View className={`add-btn ${busy ? 'off' : ''}`} onClick={busy ? undefined : onAdd}>
            <Text className='add-btn-txt'>添加</Text>
          </View>
        </View>
      </View>

      {/* 列表 */}
      {types.map((t, i) => (
        <View key={t._id} className={`ct-card paper-card ${SK[i % SK.length]} ${t.isActive ? '' : 'inactive'}`}>
          <SketchFrame color='#3A3125' opacity={0.4} sw={1.4} />
          {editingId === t._id ? (
            <View className='ct-edit'>
              <Input
                className='ct-edit-name'
                value={editName}
                onInput={(e) => setEditName(e.detail.value)}
                placeholder='名称'
                placeholderStyle={PH}
              />
              <Input
                className='ct-edit-dur'
                type='number'
                value={editDur}
                onInput={(e) => setEditDur(e.detail.value)}
                placeholder='时长'
                placeholderStyle={PH}
              />
              <Text className='ct-op save' onClick={busy ? undefined : () => saveEdit(t._id)}>
                保存
              </Text>
              <Text className='ct-op' onClick={() => setEditingId('')}>
                取消
              </Text>
            </View>
          ) : (
            <View className='ct-main'>
              <View className='ct-info'>
                <View className='ct-name-row'>
                  <Text className='ct-name'>{t.name}</Text>
                  {t.isActive ? null : <Text className='ct-badge'>已停用</Text>}
                </View>
                <Text className='ct-dur'>{t.durationMin} 分钟</Text>
              </View>
              <View className='ct-ops'>
                <Text className='ct-move' onClick={() => move(i, -1)}>
                  ↑
                </Text>
                <Text className='ct-move' onClick={() => move(i, 1)}>
                  ↓
                </Text>
                <Text className='ct-op' onClick={() => startEdit(t)}>
                  编辑
                </Text>
                <Text className='ct-op' onClick={() => toggleActive(t)}>
                  {t.isActive ? '停用' : '启用'}
                </Text>
                <Text className='ct-op danger' onClick={() => onDelete(t)}>
                  删除
                </Text>
              </View>
            </View>
          )}
        </View>
      ))}

      {needsMigration ? (
        <Text className='migrate-link' onClick={onMigrate}>
          迁移历史数据
        </Text>
      ) : null}

      {/* 预留后续板块：分组结构就位，功能陆续加入 */}
      <View className='group-head second'>
        <Text className='group-title'>更多设置</Text>
        <View className='group-rule' />
      </View>
      {FUTURE.map((f) => (
        <View key={f} className='future-row'>
          <Text className='future-name'>{f}</Text>
          <Text className='future-tag'>暂未开放</Text>
        </View>
      ))}

      <PaperToastHost />
    </View>
  )
}
