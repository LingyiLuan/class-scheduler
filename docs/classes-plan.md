# 班级 功能设计（定稿）

来源：一个老师二十多个学生，英文名常重复，希望**以班级为单位建课**。以下为最终决策，开发按此并入二期。

---

## 关系模型：底层多对多，界面默认单班

1. **用关联表 `classEnrollments`（桥表），不用 `students.classId` 单字段**：
   ```
   { studentId, classId, workspaceId, schemaVersion, joinedAt }
   ```
   底层支持一个学生属于多个班。
2. **界面默认单选**：建/编辑学员时，班级是**单选下拉**，覆盖 93% 单班场景，不给老师加操作负担。
3. **需要时能加第二个班**：学员详情里可"再加一个班"，底层本就支持，不重构。
4. **不用单字段的理由**：单字段将来出现跨班学生要**结构性重构 + 数据迁移**；桥表现在建，将来**零重构**。与 `guardianLinks` 同思路。

---

## 选班建课：预填 studentIds 的语法糖

5. 选一个班 → 查 `classEnrollments` 拿该班**当前所有学生** → **预填 `studentIds`** → 生成一期那种**多学员单节课** + **班级名快照**。扣课时逻辑一行不改（每个学生各扣自己账户）。
6. **历史课快照锁定**：排课当时把**班级名**和**学生名单**快照存进这节课。学生之后转班/退班/新加，**不影响已排的历史课**（与课程类型快照同理）。
   - session 新增：`classId`（来源班，可空）+ `className`（快照名）；沿用 `studentIds` 快照。

---

## 临时插班

7. 一个学生偶尔来上别班的课，**不改他的班级归属**，用现有"**单次多选学生**"手动加进那节课即可。
   - 区分：**长期属于某班** → 进桥表 `classEnrollments`；**临时来一次** → 只进那节课的 `studentIds`。

---

## 点名

8. 二十多人点名：**默认全到，只勾缺席**（缺席是少数，省点击）。一期"标记完成"的出勤逻辑已支持逐人，扩容为"默认 present、点掉变 absent"即可。

---

## 同名区分

9. 学员加 **`aliasCn`（中文名/备注）**，显示成「Amy（王小美）」。
   - **即使不做班级也要做**——同名是明确痛点，`aliasCn` 字段随二期第 1 步迁移一起埋，前端在**所有选人/列表处**并列显示。
   - 班级视图里再**按班分组**，进一步区分。

---

## 班级课的边界

10. 选班建课后，若班里某学生那天请假/不来，老师能在**这节课里单独移除该学生**，不影响其他人——改的是**这节课的 `studentIds`**，**不动班级归属**（桥表不变）。
11. 班级人员变动（转班、退班）后，**已排的历史课程不跟着变**，用快照锁定当时名单（见第 6 点）。

---

## 与二期集成

12. `classes` 表和 `classEnrollments` 都**归工作室**、带 `workspaceId` 和 `schemaVersion`；相关的**存量字段（`students.aliasCn`）随二期第 1 步迁移一起埋**。两张新表无存量数据，建空集合即可（见下）。
13. `classes` 表**软删**：有课程引用 / 有学生在册的班**不能硬删，只能停用**，参照课程类型删除策略。
14. 班级功能**排在二期"学员共享（第 2 步）"之后**，约第 3.7 步（学员共享打好底，班级才有意义）。

---

## 表结构（新表二期建，无存量）

`classes`（工作室级班级）
```
{ name, workspaceId, schemaVersion, isActive, sortOrder, createdAt }
```
- 软删：`isActive=false` 停用；被 `classEnrollments` 或 `classSessions.classId` 引用的班只能停用。

`classEnrollments`（学生-班级 多对多桥表）
```
{ studentId, classId, workspaceId, schemaVersion, joinedAt }
```
- 学生的班 = 按 `studentId` 查；班的学生 = 按 `classId` 查。

**存量表加字段（随二期第 1 步迁移）**
- `students` 加 `aliasCn`（中文名，可空，默认 `''`）。
- `classSessions` 建课时写 `classId`（可空）+ `className`（快照，可空）。

---

## 需手动创建（交付时提醒）
- 集合：`classes`、`classEnrollments`、`workspaceConfig`（欢迎语，已在反馈2引入）。
- 索引（量大后）：`classEnrollments` 的 `studentId`、`classId`；`classSessions.classId`。

## 开发内容（第 3.7 步展开）
- `classes` 增删改停用（复用课程类型的管理模式）。
- 学员编辑：班级单选下拉；学员详情"再加一个班"。
- 建课：新增"选班"入口 → 预填 studentIds + 快照 className。
- 选人/列表处显示 `aliasCn`「英文名（中文名）」。
- 20+ 人点名：默认全到、只勾缺席。
- 班级课单独移除某学生（改本节 studentIds）。
