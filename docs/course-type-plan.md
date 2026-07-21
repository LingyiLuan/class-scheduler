# 课程类型可配置 方案

把硬编码的 `makeup/cambridge` 改成老师可增删改的课程类型。

## 现状（实测）

`courseType` 是字符串常量 `'makeup'/'cambridge'`，硬编码在 ~10 处：
- 前端：`constants/index.ts`（enum + 默认时长）、`NewCourseForm`（TYPES 列表 + COURSE_LABEL）、卡片/详情/统计的显示
- 云端：`sessions`/`recurrences`（`COURSE_DEFAULT_DURATION` 白名单校验 + 默认时长）、`_shared/subscribe.js`（COURSE_LABEL 提醒文案）

它**只影响两件事**：①默认时长 ②显示名称。

**关键：扣课时与课程类型无关。** 扣课时是「每个出席学员固定 −1」（`sessions.complete` `delta:-1`，revert `delta:+1`）。余额 = `creditLogs.delta` 累加。

## 决策（本期定调）

- **creditCost 本期不开放自定义，固定每节扣 1 课时。**
  理由：自定义扣减会牵连课时统计、剩余课时计算、充值套餐换算，一动一串。先让老师能改课程名称和默认时长，解决 90% 需求；扣减规则等真遇到「一节剑桥扣 2」再说。
  做法：集合里**保留 `creditCost` 字段（默认 1）但不开放编辑**，为二期留位；本期扣课时逻辑不动（仍固定 −1）。
- 因固定为 1，「消耗课时」统计口径维持现状（= 出席人次），无需改动。

## 一、数据结构

新建 `courseTypes` 集合：

| 字段 | 说明 |
|---|---|
| `_id` | 主键 |
| `ownerId` | 归属老师 |
| `name` | 显示名（可改） |
| `durationMin` | 默认时长 |
| `creditCost` | 扣减课时数，固定 1（本期不开放编辑，留字段） |
| `isActive` | 启用/停用（软删） |
| `sortOrder` | 排序 |
| `slug` | 可选，存旧值 `makeup/cambridge`，让迁移与提醒文案映射稳定 |
| `createdAt/updatedAt` | — |

## 二、删除处理 —— 快照 + 软删（推荐）

三方案对比：

| 方案 | 历史显示 | 能否按类型统计 | 取舍 |
|---|---|---|---|
| 硬删 + 显示「已删除类型」 | 丢原名 | ❌ 悬空 | 省事但历史失真 |
| 纯软删 isActive | 依赖类型文档存活 | ✅ | 改名会**追溯篡改历史** |
| **快照（推荐）** | session 自带名称快照 | ✅（仍存 typeId） | 略增字段，历史不可变，正确 |

**推荐：快照 + 类型软删组合。**
- session 创建时把 `courseTypeName` + `durationMin`（已在存）快照到 session；类型改名/停用/删除都不影响历史显示。
- 同时存 `courseTypeId` 引用，供统计按类型分组、未来「编辑同类」。
- 类型软删（`isActive=false`）：停用后建课不可选，文档仍在（统计/恢复用）。
- **硬删只允许「从未被任何 session 引用」的类型**，否则只能停用。
- 「是否被引用」= 查 `classSessions.courseTypeId`（及 `recurrences.courseTypeId`）存在性。**课程多了这个查询会慢，须给 `classSessions.courseTypeId` 建索引**（云开发控制台手动建，代码无法建索引）。

## 三、扣课时规则

本期固定 −1，不随类型变（见上决策）。`creditCost` 字段留位但不生效。二期若开放：`complete` 写 `delta=-creditCost`（取 session 快照）、`revert` 用同一快照值 `+creditCost` 保证退补对称；届时再定统计口径与「课时不足」阈值语义。

## 四、管理入口（已定）

**新建轻量「设置」二级页 `pages/settings`，承载课程类型管理**；未来「课时不足阈值」等配置也放这，不二次搬家。
入口放在**首页底部**一个低调的「设置」文字链——**不占快捷四格**（学员/充值/课表/统计是高频操作，低频功能低调）。不放建课表单（那里只做选择）。

建课表单 `NewCourseForm` 改为从接口拉 `isActive` 的类型列表做选择，不再读硬编码 `TYPES`；**停用的类型在建课表单里完全不出现（不是灰掉）**——接口 `list(activeOnly=true)` 直接过滤。

## 五、迁移期兼容

分阶段、双读兼容：
1. 建集合 + 种子：把现有 `makeup/cambridge` 建成两条类型文档（`creditCost=1`，时长 90/120，`isActive=true`，`slug` 存旧值）。
2. 一次性回填脚本（幂等 + 先导出备份）：给存量 `classSessions`/`recurrences` 写 `courseTypeId`（字符串→种子 `_id`）+ `courseTypeName` 快照。历史 `delta=-1` 不动（≡ creditCost=1，自洽）。
3. 云函数双读兼容：优先读 `courseTypeId`，回退旧 `courseType` 字符串；校验从「白名单常量」改为「查 `courseTypes` 且属本人且 `isActive`」。
4. 前端双读：显示优先用 session 快照名，回退旧 `COURSE_LABEL`。
5. 共存与清理：改造期新旧字段并存，双读保证不炸；验证无误后再删旧常量/字段。

不坏的保证：存量 `delta=-1 ≡ creditCost=1` 自洽 → 余额不变；快照回填后历史显示不依赖类型文档；双读兼容避免格式并存报错；脚本幂等 + 备份可回滚。

## 决策（全部已定）

- ✅ creditCost：本期不开放，固定 1。
- ✅ 管理入口：独立「设置」二级页，入口放首页底部低调文字链（不占快捷四格）。
- ✅ 删除策略：有引用只能停用，无引用才可硬删；引用判断查 `courseTypeId`，须建索引。
- ✅ 停用类型：在建课表单里完全不出现（不是灰掉）。

## 部署注意

1. 上传部署云函数：**courseTypes（新）、sessions、recurrences、reminders**。
2. **在云开发控制台给 `classSessions` 集合的 `courseTypeId` 字段建索引**（引用查询、迁移回填都依赖它）。
3. 进「设置」页点一次**「迁移历史数据」**：种默认类型（补课/剑桥课程）+ 给存量课程回填 `courseTypeId`/`courseTypeName` 快照（幂等，可重复点）。
