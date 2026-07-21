# 技术验收清单（自用）

一期教师端上线前的必做项、遗留问题、以及一直没做的加载慢诊断。

## 一、上线前必做

### 集合（控制台手动创建，`.add` 到不存在的集合会报错）
- [ ] `courseTypes`
- [ ] `notifyLogs`
- [ ] `notifications`
- [ ] 确认已有：`users` `students` `packages` `classSessions` `recurrences` `creditLogs`

### 索引
- [ ] `notifications`：**`ownerId`(asc) + `createdAt`(desc)** 复合，非唯一（列表分页 / 未读 / 清理都用）
- [ ] `classSessions`：`courseTypeId`（类型引用检查 + 迁移回填）
- [ ] `recurrences`：`courseTypeId`
- [ ] 建议 `creditLogs`：`studentId`（余额聚合 match，提速，见加载慢诊断）
- [ ] 可选 `classSessions`：`startTime`（周视图 / 统计区间查询）

### 部署
- [ ] `pnpm sync:cloud` 后上传所有云函数：`login` `students` `packages` `sessions` `recurrences` `credits` `courseTypes` `reminders` `notifications`
- [ ] 确认定时触发器生效：`reminders` 的 `classReminderTimer`（每 10 分钟）、`notifications` 的 `notiCleanupDaily`（每日 04:00）

### 订阅消息
- [ ] `src/constants/subscribe.ts` 与 `cloudfunctions/_shared/subscribe.js` 的两个模板 ID 一致
- [ ] `_shared/subscribe.js` 字段 key（time6/thing12/thing15/thing4；thing7/short_thing3/time4/thing5）与后台模板实际关键词一致
- [ ] 正式发送走 `formal`：`sendSubscribe` 默认无 state（=formal），reminders 定时扫描无 state ✓；调试入口用 `developer`
- [ ] 真机验证订阅消息（模拟器收不到）：课前提醒、课时不足各一条

### 开关 / 收尾
- [ ] `cloudfunctions/reminders/index.js` 的 `ALLOW_DEBUG` 置 `false`
- [ ] 确认首页调试入口在正式包隐藏（`process.env.NODE_ENV === 'development'` 编译期注入，生产构建不渲染——已验证 build 时不出现）
- [ ] 有历史数据的话，进「设置」点一次「迁移历史数据」（幂等；迁移后入口自动消失）

## 二、遗留问题 / 已知取舍

- **负余额**：排课与标记完成都不校验余额，余额可为负（-1、-2…）。当前设计允许「先上后补」。**待定：是否要在标记完成时拦截/警示欠费。**
- **creditCost 固定 1**：课程类型留了 `creditCost` 字段但不开放，扣课时恒 -1/人次。二期若开放，需同步改：complete 用快照 creditCost、revert 对称、统计口径、课时不足阈值语义。
- **一次性订阅的额度**：靠 `ensureQuota` 在高频 tap 点静默补额，但**仅对已勾「总是保持」的模板**生效；未勾的用户只有铃铛/消息中心 banner 显式授权时才补。首个 tap 若缓存未预热会漏补一次（下次自愈）。
- **课前提醒**是一次性订阅、额度有限，循环课已 Toast 告知「优先提醒最近的课程」。
- **消息中心调试入口不写通知**：调试仅测推送；`notifications` 只由真实业务事件写入（避免测试数据污染消息流）。
- **markRead**：进消息中心即「全部已读」，未做「仅已加载项已读」。数据量大且分页时，后面未加载的未读也会被标记（当前 markRead(all) 是全量）——单老师无影响，多老师/大数据量再评估。
- **未建索引前**：类型引用检查、迁移回填、消息列表在大数据量下会慢（见必做项索引）。

## 三、加载慢诊断（一直没做，先定位再优化）

### 首要嫌疑：首页 N+1 余额查询
`pages/index` 的 `loadData` 流程：`listSessions`（本周）→ `listStudents` → **`Promise.all(students.map(getBalance))`**（每个学员一次云调用）→ `unreadCount`。
- 余额没有缓存字段，每次都聚合该学员全部 `creditLogs` 的 delta。
- 学员数 = N，则首页每次打开有 **N 次 `credits.getBalance` 云调用**（N+1 模式）。学员一多，首页明显变慢，且这是**每次进首页都跑**（`useDidShow`）。

### 次要点
- 学员详情、充值页也各自 `getBalance`，同样每次聚合。
- 统计页 `listSessionsRange` 用 skip 分页循环，半年数据多次往返。

### 诊断步骤
1. 造 30~50 个学员、每人若干流水，真机打开首页，掐表看耗时。
2. 云开发控制台 → 云函数 → `credits` 的调用监控，看单次首页打开触发多少次 `getBalance`、单次耗时。
3. 确认 N+1 是主因（大概率）。

### 优化选项（按性价比排序，均未实施）
1. **批量余额接口**（最高性价比）：`credits` 加 `balances({studentIds})`，一次 `aggregate.match(studentId in [...]).group(by studentId).sum(delta)` 返回所有学员余额。首页从 N 次 → 1 次调用。
2. 给 `creditLogs.studentId` 建索引，聚合 match 提速。
3. 首页「课时不足」本质只需筛 ≤2 的人，但仍要全量算余额 → 用批量接口一并解决。
4. 统计页区间查询给 `classSessions.startTime` 建索引；必要时后端聚合而非拉全量。
5. **长期（谨慎，暂不建议）**：给 `students` 维护余额快照字段。违背「creditLogs 是余额唯一真相」的设计，需在每次扣/退/充的事务里同步更新，出错会对账不平。除非批量接口仍不够快再考虑。

**建议**：先做「批量余额接口 + creditLogs.studentId 索引」，大概率一次解决首页慢；量化验证后再决定要不要碰快照字段。
