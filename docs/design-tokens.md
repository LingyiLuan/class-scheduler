# 设计规范（Design Tokens）

从设计稿 `YRoooom 排课.dc.html` 提取。落地文件：[src/styles/tokens.scss](../src/styles/tokens.scss)（全局 CSS 变量，`app.scss` 引入，各页面 `var(--x)` 使用）。

> **单位换算**：设计稿按 375px 宽，本工程 Taro `designWidth` 为 750，故 **1 设计 px = 2 rpx**。
> 下表 rpx 值即设计 px×2。颜色无单位。整体气质：青绿主色 + 蓝灰中性 + 陶土橙警示，圆润卡片、极轻阴影。

---

## 一、颜色

### 主色（青绿 teal）

| 变量 | 色值 | 用途 |
|---|---|---|
| `--color-primary` | `#5FAEBE` | 主按钮、FAB、选中态、圆点 |
| `--color-primary-strong` | `#2E8595` | 强调文字、数字、图标、链接、青色小标签字 |
| `--color-primary-tint` | `#EAF1F3` | 主色浅底（头像底、信息块、青色标签底） |
| `--color-primary-muted` | `#7AA6AE` | 弱化主色文字（如充值前旧余额） |

### 中性（蓝灰阶）

| 变量 | 色值 | 用途 |
|---|---|---|
| `--color-ink` | `#1C2329` | 主文字、标题 |
| `--color-text-strong` | `#2A333B` | 次要按钮文字、课时数字（充足） |
| `--color-text` | `#3A424A` | 次级文字/图标 |
| `--color-text-label` | `#5A6570` | 表单标签、分区小标题 |
| `--color-text-secondary` | `#8A929B` | 日期、说明 |
| `--color-text-tertiary` | `#98A0A8` | 辅助说明、占位、已取消状态字 |
| `--color-text-quaternary` | `#A9B0B7` | 更弱说明、计数 |
| `--color-text-disabled` | `#B7BEC5` | 空态、禁用 |
| `--color-icon-muted` | `#C4CACF` | 箭头等弱图标 |

### 背景与描边

| 变量 | 色值 | 用途 |
|---|---|---|
| `--color-bg` | `#F4F6F8` | 页面底色 |
| `--color-surface` | `#FFFFFF` | 卡片、列表容器 |
| `--color-fill` | `#F6F7F9` | 输入框、弱填充块 |
| `--color-fill-chip` | `#F0F2F4` | 小标签底、时长胶囊 |
| `--color-row-active` | `#F7F8FA` | 列表行按压态 |
| `--color-border` | `#EEF0F2` | 默认描边、卡片分隔 |
| `--color-border-strong` | `#D8DCE0` | 次要按钮描边 |
| `--color-divider` | `#F0F2F4` | 表单项/列表内分隔线 |

### 危险 / 警示（陶土橙红 terracotta）

| 变量 | 色值 | 用途 |
|---|---|---|
| `--color-danger` | `#D6552F` | 危险文字/图标（删除、缺勤、不足） |
| `--color-danger-strong` | `#C24A28` | 更深的危险字（预警标题） |
| `--color-danger-accent` | `#F07850` | 圆点、角标、通知红点 |
| `--color-danger-bg` | `#FBEBE5` | 危险浅底、不足标签底 |
| `--color-danger-bg-soft` | `#FDEEE8` | 预警卡片底、危险按钮按压底 |
| `--color-danger-border` | `#F0D4CB` | 危险按钮描边 |
| `--color-danger-sub` | `#CC9977` | 危险语境下的弱化字（“次”单位） |

---

## 二、字号与字重层级

字重：**700** 粗（标题/数字）· **600** 半粗（姓名/按钮/标签）· **500** 中（次要说明）· **400** 常规。
数字统一 `font-variant-numeric: tabular-nums`。

| 变量 | rpx (设计px) | 字重 | 用途 |
|---|---|---|---|
| `--font-hero` | 46rpx (23) | 700 | 首页问候语 |
| `--font-stat` | 52rpx (26) | 700 | 统计大数字、剩余课时大数 |
| `--font-page-title` | 40rpx (20) | 700 | 一级页面标题（课表/学员） |
| `--font-number` | 36rpx (18) | 700 | 列表内课时数字 |
| `--font-nav-title` | 34rpx (17) | 600 | 二级页导航标题 |
| `--font-section` | 32rpx (16) | 700 | 区块标题（今日课程） |
| `--font-name` | 30rpx (15) | 600 | 姓名、正文强调、按钮 |
| `--font-body` | 28rpx (14) | 400/600 | 正文、输入 |
| `--font-body-sm` | 26rpx (13) | 400 | 次要正文、分区小标题 |
| `--font-caption` | 24rpx (12) | 400 | 说明、单位 |
| `--font-tag` | 22rpx (11) | 500 | 级别标签、类型胶囊 |
| `--font-micro` | 21rpx (10.5) | 600 | 角标（如“课时不足”小标） |

---

## 三、间距系统

| 变量 | rpx (设计px) | 用途 |
|---|---|---|
| `--space-xs` | 8rpx (4) | 紧凑间隙 |
| `--space-sm` | 16rpx (8) | 元素间小间隙、grid gap |
| `--space-md` | 20rpx (10) | 卡片内元素间距 |
| `--space-lg` | 28rpx (14) | 卡片内边距、块间隙 |
| `--space-xl` | 32rpx (16) | 屏幕左右边距、卡片内边距 |
| `--space-2xl` | 40rpx (20) | 区块之间的分隔 |
| `--space-screen` | 32rpx (16) | 页面统一左右边距 |

---

## 四、圆角

| 变量 | rpx (设计px) | 用途 |
|---|---|---|
| `--radius-xs` | 10rpx (5) | 小标签、时长胶囊、角标 |
| `--radius-sm` | 20rpx (10) | 小按钮、搜索框、小头像 |
| `--radius-md` | 24rpx (12) | 按钮、输入框、信息块 |
| `--radius-lg` | 28rpx (14) | 卡片、列表容器 |
| `--radius-xl` | 32rpx (16) | 大卡片、大头像 |
| `--radius-pill` | 34rpx (17) | FAB、胶囊按钮 |

---

## 五、阴影

极轻、冷灰色投影（`rgba(20,30,40,…)`），主色按钮用主色辉光。

| 变量 | 值 | 用途 |
|---|---|---|
| `--shadow-card` | `0 2rpx 6rpx rgba(20,30,40,.05)` | 卡片、列表容器 |
| `--shadow-subtle` | `0 2rpx 4rpx rgba(20,30,40,.04)` | 搜索框等弱浮起 |
| `--shadow-raised` | `0 2rpx 6rpx rgba(20,30,40,.06)` | 首页顶部图标按钮 |
| `--shadow-fab` | `0 16rpx 40rpx -8rpx rgba(46,133,149,.55)` | 悬浮主按钮（青色辉光） |

---

## 六、按钮三层级

统一高度约 **92rpx（46px）**，圆角 `--radius-md`，字号 `--font-name`(30rpx/600)。

| 层级 | 底 | 字 | 描边 | 按压 | 用途 |
|---|---|---|---|---|---|
| **主操作** | `--color-primary` | `#FFF` | 无 | `opacity:.88` | 保存、确认充值、标记完成、创建 |
| **次要** | 透明 | `--color-text-strong` | `1px --color-border-strong` | `bg --color-bg` | 编辑、撤销 |
| **危险** | 透明 | `--color-danger` | `1px --color-danger-border` | `bg --color-danger-bg-soft` | 删除、缺勤 |

小尺寸主按钮（如“新增”）：`padding 7px 13px`、`--radius-sm`、`--font-body-sm`(13px)/600、按压 `opacity:.85`。

---

## 七、状态与课时的视觉编码

### 课程四种状态（字色 / 底色 / 圆点）

| 状态 | 标签 | 字色 | 底色 | 圆点 |
|---|---|---|---|---|
| `scheduled` 待上课 | 待上课 | `#2E8595` | `#E4F1F3` | `#5FAEBE` |
| `completed` 已完成 | 已完成 | `#4E9B6B` | `#E9F3EC` | `#5FB07D` |
| `absent` 缺勤 | 缺勤 | `#D6552F` | `#FBEBE5` | `#F07850` |
| `cancelled` 已取消 | 已取消 | `#98A0A8` | `#F0F2F4` | `#B7BEC5` |

课程卡片左侧有一条 3px 竖色条，颜色取该状态圆点色；状态 chip 为「底色 + 字色 + 小圆点」。

### 学员课时充足 / 不足

判定：**剩余课时 `< 2` 记为「不足」**（设计稿口径）。
> ⚠️ plan/首页需求曾写「≤2 次」预警。二者差一档（是否含 2），落地前需确认取其一，`tokens.scss` 里以变量 `--credit-low-threshold` 记录，默认按设计 `< 2`。

| 状态 | 数字色 | 底色 | 单位/弱字 |
|---|---|---|---|
| 充足 | `#2E8595`（列表数字用 `#2A333B`） | `#EAF1F3` | `#7AA6AE` |
| 不足 | `#D6552F` | `#FBEBE5` | `#CC9977` |

不足时额外显示「课时不足」小标（`--font-micro`，字 `#D6552F`，底 `#FBEBE5`，`--radius-xs`）。
首页「课时不足预警」卡片：底 `--color-danger-bg-soft`、描边 `--color-danger-border`。

---

## 待确认

1. 课时不足阈值：设计 `< 2` vs 需求「≤2」——取哪个？
2. NutUI 组件默认主色是红，与本设计青绿不一致；重构时需给 NutUI 重设主题色
   （`--nutui-color-primary` 等），已在 tokens.scss 预留说明。
