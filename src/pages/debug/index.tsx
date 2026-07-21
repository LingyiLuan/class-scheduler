import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { callFunction, ApiError } from '../../services/api'
import './index.scss'

// TODO 临时云函数调试面板，上线前删除（含 app.config.ts 里的 'pages/debug/index' 路由）

interface Row {
  step: string
  detail: string
  expected?: string
  actual?: string
  pass: boolean | null // null 表示信息行，无预期判定
}

interface CallResult {
  ok: boolean
  code: number
  msg?: string
  data?: any
}

// 包一层：silent 不弹 toast，把成功/业务失败都以对象返回，便于按预期断言（如冲突 40901）
async function call(name: string, data?: Record<string, unknown>): Promise<CallResult> {
  try {
    const d = await callFunction<any>(name, data, { silent: true })
    return { ok: true, code: 0, data: d }
  } catch (e) {
    const err = e as ApiError
    return { ok: false, code: err.code, msg: err.message, data: err.data as any }
  }
}

export default function Debug() {
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)

  const runner = (fn: (push: (r: Row) => void) => Promise<void>) => async () => {
    if (running) return
    setRunning(true)
    const acc: Row[] = []
    const push = (r: Row) => {
      acc.push(r)
      setRows([...acc])
    }
    try {
      await fn(push)
    } catch (e) {
      push({ step: '异常中断', detail: String((e as Error).message || e), pass: false })
    } finally {
      setRunning(false)
    }
  }

  async function balanceOf(studentId: string): Promise<number> {
    const r = await call('credits', { action: 'getBalance', data: { studentId } })
    return r.ok ? Number(r.data.balance) : NaN
  }

  // 组 1：单人一条龙
  const runSolo = runner(async (push) => {
    const c = await call('students', { action: 'create', data: { name: '调试学员' } })
    push({ step: '1 建学员', detail: c.ok ? `id=${c.data._id}` : `失败 ${c.code} ${c.msg}`, pass: c.ok })
    if (!c.ok) return
    const sid = c.data._id

    const p = await call('packages', { action: 'create', data: { studentId: sid, totalCredits: 10 } })
    push({ step: '2 充值10', detail: p.ok ? 'ok' : `失败 ${p.code} ${p.msg}`, pass: p.ok })

    let b = await balanceOf(sid)
    push({ step: '3 查余额', detail: '', expected: '10', actual: String(b), pass: b === 10 })

    const s = await call('sessions', {
      action: 'create',
      data: { courseType: 'makeup', startTime: '2099-03-01T10:00:00+08:00', studentIds: [sid] }
    })
    push({ step: '4 建课', detail: s.ok ? `id=${s.data._id}` : `失败 ${s.code} ${s.msg}`, pass: s.ok })
    if (!s.ok) return
    const sess = s.data._id

    await call('sessions', { action: 'complete', data: { id: sess } })
    b = await balanceOf(sid)
    push({ step: '5 完成', detail: '', expected: '9', actual: String(b), pass: b === 9 })

    await call('sessions', { action: 'reopen', data: { id: sess } })
    b = await balanceOf(sid)
    push({ step: '6 撤销', detail: '', expected: '10', actual: String(b), pass: b === 10 })

    await call('sessions', { action: 'complete', data: { id: sess } })
    b = await balanceOf(sid)
    push({ step: '7 再完成', detail: '', expected: '9', actual: String(b), pass: b === 9 })

    await call('sessions', { action: 'reopen', data: { id: sess } })
    b = await balanceOf(sid)
    push({ step: '8 再撤销', detail: '', expected: '10', actual: String(b), pass: b === 10 })

    await call('sessions', { action: 'cancel', data: { id: sess } })
    const d = await call('students', { action: 'delete', data: { id: sid } })
    push({ step: '9 清理(取消课+软删学员)', detail: d.ok ? 'ok' : `失败 ${d.code}`, pass: d.ok })
  })

  // 组 2：小班课出勤
  const runGroup = runner(async (push) => {
    const ca = await call('students', { action: 'create', data: { name: '调试A' } })
    const cb = await call('students', { action: 'create', data: { name: '调试B' } })
    push({ step: '1 建两学员', detail: `A=${ca.data?._id} B=${cb.data?._id}`, pass: ca.ok && cb.ok })
    if (!ca.ok || !cb.ok) return
    const a = ca.data._id
    const bId = cb.data._id

    await call('packages', { action: 'create', data: { studentId: a, totalCredits: 10 } })
    await call('packages', { action: 'create', data: { studentId: bId, totalCredits: 10 } })
    push({ step: '2 各充值10', detail: 'ok', pass: null })

    const s = await call('sessions', {
      action: 'create',
      data: { courseType: 'makeup', startTime: '2099-03-02T10:00:00+08:00', studentIds: [a, bId] }
    })
    push({ step: '3 建小班课(两人)', detail: s.ok ? `id=${s.data._id}` : `失败 ${s.code}`, pass: s.ok })
    if (!s.ok) return
    const sess = s.data._id

    await call('sessions', {
      action: 'complete',
      data: { id: sess, attendance: { [a]: 'present', [bId]: 'absent' } }
    })
    let ba = await balanceOf(a)
    let bb = await balanceOf(bId)
    push({ step: '4 完成 A出席B缺勤 · A', detail: '', expected: '9', actual: String(ba), pass: ba === 9 })
    push({ step: '   · B', detail: '', expected: '10', actual: String(bb), pass: bb === 10 })

    await call('sessions', { action: 'reopen', data: { id: sess } })
    ba = await balanceOf(a)
    bb = await balanceOf(bId)
    push({ step: '5 撤销 · A', detail: '', expected: '10', actual: String(ba), pass: ba === 10 })
    push({ step: '   · B', detail: '', expected: '10', actual: String(bb), pass: bb === 10 })

    await call('sessions', { action: 'cancel', data: { id: sess } })
    await call('students', { action: 'delete', data: { id: a } })
    await call('students', { action: 'delete', data: { id: bId } })
    push({ step: '6 清理', detail: 'ok', pass: null })
  })

  // 组 3：冲突检测
  const runConflict = runner(async (push) => {
    const c = await call('students', { action: 'create', data: { name: '调试冲突' } })
    push({ step: '0 建学员', detail: c.ok ? 'ok' : `失败 ${c.code}`, pass: c.ok })
    if (!c.ok) return
    const sid = c.data._id
    const created: string[] = []

    const s1 = await call('sessions', {
      action: 'create',
      data: { courseType: 'makeup', startTime: '2099-03-03T10:00:00+08:00', durationMin: 90, studentIds: [sid] }
    })
    push({ step: '1 建 10:00-11:30', detail: s1.ok ? 'ok' : `失败 ${s1.code}`, pass: s1.ok })
    if (s1.ok) created.push(s1.data._id)

    const s2 = await call('sessions', {
      action: 'create',
      data: { courseType: 'makeup', startTime: '2099-03-03T11:00:00+08:00', durationMin: 90, studentIds: [sid] }
    })
    const s2ok = !s2.ok && s2.code === 40901 && Array.isArray(s2.data?.conflicts) && s2.data.conflicts.length > 0
    push({
      step: '2 建 11:00-12:30',
      detail: `code=${s2.code} conflicts=${s2.data?.conflicts?.length ?? 0}`,
      expected: '40901+conflicts',
      actual: String(s2.code),
      pass: s2ok
    })
    if (s2.ok) created.push(s2.data._id)

    const s3 = await call('sessions', {
      action: 'create',
      data: { courseType: 'makeup', startTime: '2099-03-03T11:30:00+08:00', durationMin: 90, studentIds: [sid] }
    })
    push({
      step: '3 建 11:30-13:00(接续)',
      detail: s3.ok ? 'ok' : `失败 ${s3.code} ${s3.msg}`,
      expected: '成功',
      actual: s3.ok ? '成功' : `失败${s3.code}`,
      pass: s3.ok
    })
    if (s3.ok) created.push(s3.data._id)

    for (const id of created) await call('sessions', { action: 'cancel', data: { id } })
    await call('students', { action: 'delete', data: { id: sid } })
    push({ step: '4 清理', detail: `取消 ${created.length} 节课 + 软删学员`, pass: null })
  })

  const failCount = rows.filter((r) => r.pass === false).length
  const passCount = rows.filter((r) => r.pass === true).length

  return (
    <View className='debug'>
      <Text className='title'>云函数调试面板（TODO 上线前删）</Text>
      <View className='btns'>
        <Button className='b' size='mini' type='primary' loading={running} onClick={runSolo}>
          单人一条龙
        </Button>
        <Button className='b' size='mini' type='primary' loading={running} onClick={runGroup}>
          小班课
        </Button>
        <Button className='b' size='mini' type='primary' loading={running} onClick={runConflict}>
          冲突检测
        </Button>
      </View>
      <Text className='summary'>
        通过 {passCount} · 失败 {failCount}
      </Text>
      <View className='rows'>
        {rows.map((r, i) => (
          <View key={i} className={`row ${r.pass === false ? 'fail' : ''} ${r.pass === true ? 'okrow' : ''}`}>
            <Text className='step'>{r.step}</Text>
            <Text className='detail'>
              {r.expected !== undefined ? `期望 ${r.expected} / 实际 ${r.actual}  ` : ''}
              {r.detail}
              {r.pass === false ? '  ✗ 不符预期' : r.pass === true ? '  ✓' : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
