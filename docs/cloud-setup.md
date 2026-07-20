# 云开发初始化

首次部署前，在**微信开发者工具 → 云开发控制台**完成以下配置。集合与索引需手动创建
（`db.collection(x).add()` 要求集合已存在）。

## 1. 开通云开发

云开发 → 开通 → 选免费套餐 → 记下**环境 ID**，填入项目 `.env` 的 `TARO_APP_CLOUD_ENV`
（或 `src/constants/cloud.ts` 的兜底值）。

## 2. 创建集合

在「数据库」新建以下 6 个集合，**权限均设为「仅创建者可读写」中最严的「仅管理端可读写」**
（小程序端一律经云函数访问，云函数以管理员身份操作）。字段结构见 [schema.md](schema.md)。

| 集合 | 说明 |
|---|---|
| `users` | 账号（openid、role、isActive、boundStudentIds） |
| `students` | 学员档案（ownerId、inviteCode、userId…） |
| `packages` | 课包购买记录 |
| `classSessions` | 课程实例 |
| `recurrences` | 循环课规则 |
| `creditLogs` | 课时流水（只增不改） |

## 3. 创建索引

数据库 → 对应集合 → 索引管理，新建：

| 集合 | 索引字段 | 说明 |
|---|---|---|
| `users` | `openid` | 建议设为唯一 |
| `students` | `ownerId` | |
| `students` | `inviteCode` | 建议设为唯一 |
| `classSessions` | `ownerId` | |
| `classSessions` | `startTime` | 课表按时间查询 |
| `creditLogs` | `studentId` | 余额累加 |

## 4. 部署云函数

见 [../cloudfunctions/README.md](../cloudfunctions/README.md)：先 `pnpm sync:cloud` 同步 `_shared`，
再在开发者工具里右键各函数「上传并部署（云端安装依赖）」。

## 5. 首个用户成为 owner

云函数 `login` 首次被调用时，若 `users` 集合为空，则将该 openid 设为 `role=owner, isActive=true`。
因此**用你自己的微信第一个登录**即成为 owner。后续登录者默认 `role=teacher, isActive=false`，
需在控制台把其 `isActive` 手动改为 `true` 才能使用。
