# 消息中心方案设计（订阅消息的兜底）

## 为什么需要

订阅消息是「尽力而为」的推送：额度可能断（用户没勾「总是保持」、或极端情况额度耗尽）、用户可能关掉系统通知、可能没及时看。**消息中心是应用内的可靠信息流**：每一条值得提醒的事件都在这里留底，额度万一断了信息也不丢。

核心原则：**消息中心的写入发生在「业务事件」处，不依赖推送是否成功。** 推送是锦上添花，消息中心才是真相来源。

## 数据结构

新建 `notifications` 集合（每位老师一条条 feed）：

| 字段 | 说明 |
|---|---|
| `_id` | 主键 |
| `ownerId` | 归属老师（收件人） |
| `type` | `classReminder`（课前提醒）/ `lowCredit`（课时不足）/ `creditDeducted`（扣课时，二期）|
| `title` | 如「课前提醒」 |
| `body` | 如「15:00 剑桥课程 · kk，距上课约 1 小时」——展示文案，创建时定稿（快照） |
| `refType` | `session` / `student` |
| `refId` | 关联 sessionId / studentId，点击可跳详情 |
| `readAt` | null 表示未读；标记已读时写时间 |
| `createdAt` | 服务端时间 |

与现有 `notifyLogs` 的区别：`notifyLogs` 是**推送技术审计**（errCode/errMsg，排障用）；`notifications` 是**用户可见信息流**。两者语义不同、保留各自：一次课时不足事件 = 1 条 notification，但可能对应 0 或 1 次推送尝试。

## 写入路径（与推送去重标记复用）

在每个业务触发点，**先写 notification，再尝试推送**，两者共用同一去重标记：

- **课前提醒**：reminders 定时器扫到课进入窗口时 → 写 `classReminder` notification + 尝试 push；已有的 `classReminderSentAt` 标记同时防重复写 notification。
- **课时不足**：`sessions.complete` 扣课时后跌破 ≤2 时 → 写 `lowCredit` notification + 尝试 push；复用 `lowCreditNotified` 标记去重。
- **扣课时（二期）**：每次扣课时 → 写 `creditDeducted` notification「已扣 N 课时，剩余 M」+ push。消息中心天然容纳。

实现上可在云端封装 `notify({ownerId, type, title, body, refType, refId})`：写 notification →（可选）调 `sendSubscribe` 推送。业务代码只调 `notify`。

## 读取路径

`notifications` 云函数（或并入现有函数）：
- `list`：本人、按 `createdAt` 倒序、分页。
- `unreadCount`：`readAt == null` 计数（首页铃铛红点用）。
- `markRead`：单条或全部标记已读。

## UI 与「铃铛」角色的调整（需你确认）

现在铃铛 = 订阅授权入口（含首次引导）。消息中心落地后，铃铛更适合承担**消息入口**。两种走法：

- **方案 A（推荐）**：铃铛 → 打开消息中心页（带**未读红点**）。授权引导移到消息中心页顶部一个 banner：「开启自动提醒（勾选总是保持）」，仅在 `!quotaSettled()` 时出现。静默补额仍挂在各 tap 点（已实现）。这样「提醒」相关的一切（信息流 + 授权）统一在一个地方。
- **方案 B**：铃铛保持 = 授权；另加独立「消息」入口（如首页 quick 行加一项，或第二个图标）。

倾向 A：入口不增多，语义统一。**代价**：需把当前"铃铛直接弹授权引导"改成"铃铛开消息中心 + 页内 banner 引导"。在消息中心未做之前，铃铛维持现状（直接引导授权）。

## 页面

新建 `pages/messages`（消息中心）：
- 顶部（方案 A）：未勾「总是保持」时的授权引导 banner。
- 列表：手绘纸片卡，每条 title / body / 相对时间；未读左侧一个红铅笔圆点标记。
- 点击一条 → 跳 refId 详情（课程/学员）并标记已读。
- 右上「全部已读」。
- 进入页面时拉 list + markRead（或点击各条时逐条已读，二选一）。

首页铃铛加未读红点：首页 `useDidShow` 时取 `unreadCount`，>0 显示 `StatusMark` 小圆点。

## 保留/清理

notifications 可只保留近 90 天或最近 200 条，超出后台定时清理（可选，非必须）。

## 落地顺序（本方案属后续实现，非本次）

1. `notifications` 集合 + 云端 `notify()` 封装
2. reminders / sessions 的推送点旁加 `notify()` 写入
3. `notifications` 云函数 list / unreadCount / markRead
4. `pages/messages` 页面 + 铃铛改为入口 + 未读红点 + 授权 banner（方案 A）
