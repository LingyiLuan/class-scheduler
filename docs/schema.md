# 云数据库集合设计

微信云开发 · 文档型数据库。定义依据：docs/plan.md、docs/dev-guide.md、docs/scheduling-rules.md。

小程序端**不直接读写数据库**：云数据库客户端权限设为「仅管理端可读写」，所有操作经云函数，
云函数用 `cloud.getWXContext()` 取 openid、查 `users` 得角色后校验权限。

---

## 账号与档案分离（数据设计的基础）

- **账号 `users`**：谁在使用小程序。云函数中 `getWXContext()` 直接拿 openid，无需用户授权。存身份与权限。
- **档案 `students`**：老师录入的业务数据（姓名、手机号、课时），与微信账号无关。

一期学员不登录，`students.userId` 为空。二期学员/家长登录后，通过邀请码（`inviteCode`）主动绑定，
届时回填 `students.userId`。微信个人主体只提供 openid、不提供姓名手机号，无法自动匹配，故必须由用户
提供凭证绑定；二期升级企业主体后可改用手机号自动匹配，结构不变。

---

## 集合

### users — 账号

| 字段 | 类型 | 说明 |
|---|---|---|
| openid | String | 唯一，主键 |
| nickname | String | |
| avatarUrl | String | |
| role | String | owner / teacher / student |
| isActive | Boolean | 新 teacher 默认 false，需 owner 激活 |
| boundStudentIds | Array | 二期用，一期为空数组 |
| createdAt | Date | |

### students — 学员档案

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | String | |
| ownerId | String | 创建者 openid |
| name | String | |
| phone | String | |
| levelTag | String | |
| note | String | |
| inviteCode | String | 6 位，创建时生成，二期绑定用；字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（避易混淆） |
| userId | String | 一期为 null，二期绑定后填入 |
| isDeleted | Boolean | 软删标记，默认 false；删除只置 true，保留关联流水/历史课的可追溯 |
| createdAt | Date | |

### packages — 课包（购买事件）

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | String | |
| studentId | String | |
| totalCredits | Number | |
| purchasedAt | Date | |
| note | String | |

> 购买时**同步**写一条 `creditLogs`（delta 为正、reason=purchase），二者须在事务中完成。
> 余额只由 `creditLogs` 累加，`packages` 仅留存购买记录。

### classSessions — 课程实例

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | String | |
| ownerId | String | |
| courseType | String | makeup(90 分钟) / cambridge(120 分钟) |
| startTime | Date | |
| durationMin | Number | |
| status | String | scheduled / completed / absent / cancelled |
| recurrenceId | String | 循环课关联，单次课为 null |
| studentIds | Array | 小班课学员数组 |
| attendance | Object | `{ studentId: 'present' \| 'absent' }` |
| note | String | |

### recurrences — 循环课规则

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | String | |
| ownerId | String | |
| weekday | Number | 0-6 |
| timeOfDay | String | HH:mm |
| durationMin | Number | |
| courseType | String | |
| studentIds | Array | |
| startDate | Date | |
| endDate | Date | **必填** |

### creditLogs — 课时流水（唯一真相来源，append-only）

| 字段 | 类型 | 说明 |
|---|---|---|
| _id | String | |
| studentId | String | |
| sessionId | String | |
| delta | Number | 正数充值 / 负数消耗 |
| reason | String | purchase(充值) / attend(出席扣减) / absent(缺勤扣减，一期未用) / revert(撤销完成的反向入账) / manual(手工调整) |
| createdAt | Date | |

---

## 硬性约束

- 课时余额**必须**由 `creditLogs.delta` 累加得出，**不设**任何可直接修改的余额字段。
- 任何课时变动必须写入一条流水，含原因与关联课程 ID，以便争议时完整回溯。
- 小班课完成 → 为每个出席学员各写一条 `attend(-1)`；撤销 → 各写一条 `manual(+1)`。请假（absent）不写流水。
- 更正一律**追加反向记录**，不 UPDATE/DELETE 历史流水。

## 索引

`students.ownerId`、`students.inviteCode`、`classSessions.ownerId`、`classSessions.startTime`、`creditLogs.studentId`

## 权限模型

云函数统一：`getWXContext()` 拿 openid → 查 `users` 得 role → 按 role 判断读写范围。

| 角色 | 权限 |
|---|---|
| owner | 全部读写 |
| teacher | 仅读写 `ownerId` 为自己的记录 |
| student | 仅读与自己绑定学员相关的数据（二期启用） |

一期只实现 owner；首个登录用户自动成为 owner，后续用户默认 `role=teacher, isActive=false`，
在云开发控制台手动激活。学生端返回课程数据时，须过滤掉同班其他学员的姓名等隐私信息。
