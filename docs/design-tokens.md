# 设计规范（Design Tokens）· 手绘纸质版

从设计稿提取（`docs/design/YRoooom-设计规范.dc.html`、`YRoooom-手绘版.dc.html`）。
落地：[src/styles/tokens.scss](../src/styles/tokens.scss)（全局 CSS 变量）、
[src/styles/sketch.scss](../src/styles/sketch.scss)（手绘工具类）、
[src/components/sketch/](../src/components/sketch/)（SVG 描边组件）、
[src/styles/fonts.scss](../src/styles/fonts.scss)（Caveat 手写体）。

> **风格**：手绘纸质文具风——牛皮纸底 + 暖石墨铅笔线条 + 彩铅点缀（teal/coral）。装饰服务于可读性。
> **单位**：设计稿 375px，工程 designWidth 750，故 **1 设计px = 2rpx**（下表 rpx = 设计px×2）。
> **上一版青绿扁平方案已作废**。

---

## 一、纸张底色

| 变量 | 色值 | 用途 |
|---|---|---|
| `--paper-kraft` | `#E7DABB` | 页面底（牛皮） |
| `--paper-cream` | `#F3E9D2` | 页面底（米白，备选） |
| `--paper-card` | `#FAF3E1` | 卡片/便签 |

纹理：SVG `feTurbulence`（fractalNoise, baseFrequency 0.85, numOctaves 2）叠加，`opacity .4`、`mix-blend-mode:multiply`，**内联 ~0KB**。见 `.paper-grain`（⚠️ weapp 对 SVG 滤镜支持不确定，需真机验证，退化为纯色底）。

## 二、铅笔色阶（暖石墨，非纯黑）

| 变量 | 色值 | 用途 |
|---|---|---|
| `--ink-title` | `#33291C` | 标题 |
| `--ink-body` | `#4A4030` | 正文 |
| `--ink-secondary` | `#6E6250` | 次要 |
| `--ink-tertiary` | `#A2937B` | 三级 |
| `--ink-placeholder` | `#B5A88C` | 占位 |
| `--ink-stroke` | `rgba(58,49,37,.5)` | 手绘描边（#3A3125 半透） |

## 三、强调色（彩铅点缀，克制）

| 变量 | 色值 | 用途 |
|---|---|---|
| `--accent-teal` / `-ink` / `-bg` | `#6BB5C4` / `#2E7C8A` / `#E1EEEE` | 品牌、链接、青色标注 |
| `--accent-coral` / `-ink` / `-bg` | `#F07850` / `#C24A28` / `#FAEBE2` | 提醒、圈选、课时不足 |
| `--accent-green` | `#3E8C7E` | 完成 |
| `--highlight-cream` | `#FAF5E9` | 高亮 |

## 四、字体（重要约束）

- **中文 → 系统字体**（PingFang SC / 系统默认）。中文字体 3–10MB，小程序主包上限 2MB，**不引入**。手绘气质由背景/边框/图标/装饰承载。
- **英文装饰 → Caveat 手写体**。子集（a–z + 基础标点，weight 600）= **15KB woff2 / base64 ~20KB**，已 base64 内嵌 `fonts.scss`（weapp 不支持引本地字体文件）。**仅用于装饰性英文标注**（today / this week / free day…），不承载功能信息。用 `.cav` 类。

## 五、字号 / 字重

字重：**700** 粗（标题/数字）· **600** 正文 · **500** 次要 · **400** 常规。数字 `tabular-nums`。

| 变量 | rpx (设计px) | 字重 | 用途 |
|---|---|---|---|
| `--font-stat` | 56rpx (28) | 700 | 卡片主数字 |
| `--font-page-title` | 42rpx (21) | 700 | 页面标题 |
| `--font-nav-title` | 34rpx (17) | 600 | 二级页导航标题 |
| `--font-section` | 32rpx (16) | 700 | 区块标题 |
| `--font-name` | 30rpx (15) | 600 | 姓名/正文强调 |
| `--font-body` | 28rpx (14) | 600 | 正文 |
| `--font-caption` | 24rpx (12) | 500 | 次要/说明 |
| `--font-tag` | 22rpx (11) | 600 | 标签 |

## 六、间距（基数 4）

| 变量 | rpx (设计px) | 用途 |
|---|---|---|
| `--space-xs` | 8rpx (4) | 紧凑 |
| `--space-sm` | 16rpx (8) | 元素间距 |
| `--space-md` | 24rpx (12) | 元素间距 |
| `--space-lg` | 32rpx (16) | 卡片内边距 |
| `--space-screen` | 36rpx (18) | 页面边距 |
| `--space-section` | 44rpx (22) | 区块间距 |

## 七、圆角 & 手绘边框

**① 八值不规则圆角**——每个卡片取略不同的值，避免统一。5 组（`--radius-sketch-1..5` / 工具类 `.sk-1..5`）：

| 组 | 值（rpx） |
|---|---|
| 1 | `28rpx 32rpx 22rpx 30rpx / 30rpx 22rpx 32rpx 28rpx` |
| 2 | `32rpx 24rpx 30rpx 26rpx / 26rpx 30rpx 24rpx 32rpx` |
| 3 | `30rpx 26rpx 32rpx 24rpx / 24rpx 32rpx 26rpx 30rpx` |
| 4 | `26rpx 32rpx 24rpx 30rpx / 30rpx 24rpx 32rpx 26rpx` |
| 5（按钮） | `28rpx 22rpx 30rpx 24rpx / 24rpx 30rpx 22rpx 28rpx` |

**② SketchFrame SVG 铅笔描边**——抖动圆角矩形路径 + `vector-effect:non-scaling-stroke`，任意尺寸线宽恒定。组件 `<SketchFrame color opacity sw />`（weapp 用背景 SVG data URI 承载），与 CSS 边框叠成「双线」手绘感。

**③ 波浪分隔线**——平铺 SVG 替代直线，工具类 `.wave-divider`。

**④ 偏移阴影**——`1.6–2.6px` 无模糊，像纸片微翘：
- `--shadow-paper`: `4rpx 6rpx 0 rgba(58,49,37,.09)`（卡片）
- `--shadow-btn`: `4rpx 6rpx 0 rgba(58,49,37,.2)`（主按钮）

手绘边框线宽约 `3rpx`（1.5px），色 `--ink-stroke`。

## 八、按钮三层级

高 ~96rpx，圆角 `.sk-5`，字 `--font-name`(30rpx)/700。

| 层级 | 底 | 字 | 描边 | 用途 |
|---|---|---|---|---|
| **主操作** | `#3A3226`（深铅笔填充） | `#FBF3E0` | 无 + `--shadow-btn` | 充值/保存/创建/完成 |
| **次要** | `#FCF5EA` | `#3A3226` | `3rpx --ink-stroke` | 编辑/取消 |
| **危险** | `#FAEBE2` | `#C24A28` | `3rpx #E0906F` | 删除 |

## 九、状态与课时视觉编码

**课程四态 = 手写批改隐喻**（圈/勾/叉/划掉），用 `<StatusMark status>` SVG 图标 + 同色文字：

| 状态 | 记号 | 色 |
|---|---|---|
| `scheduled` 待上课 | ◯ 圈 | `#7A6E58` |
| `completed` 已完成 | ✓ 勾 | `#3E8C7E` |
| `absent` 缺勤 | ✕ 叉 | `#C24A28` |
| `cancelled` 已取消 | 〜 划掉（文字加删除线） | `#A2937B` |

**课时充足 / 不足**：判定 **剩余 ≤ 2 记为不足**（含 2）。
- 充足：石墨字（`--ink-title`）。
- 不足：coral 字 `#C24A28` + 手绘圈选（`<StatusMark>` 的 oval 变体 `#F07850`）。

---

## NutUI 主题

NutUI 默认主色为红，与本设计冲突（红仅留危险）。已在 `tokens.scss` 覆盖
`--nutui-color-primary` 为主按钮深铅笔色 `#3A3226`。手绘细节（描边/纸感/不规则圆角）
NutUI 组件做不到，重构时对关键组件叠加 SketchFrame/工具类覆盖样式。
