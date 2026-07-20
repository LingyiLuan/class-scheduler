# 云函数目录

本目录为微信云开发的云函数根目录（`project.config.json` 的 `cloudfunctionRoot`）。
小程序端不直接读写云数据库，所有数据操作经此处云函数，云函数内校验身份与权限。

云函数在**指令二**开始编写，规划结构：

```
cloudfunctions/
  _shared/        共享工具（auth.js 身份校验、credits.js 课时计算）
  login/          登录，返回 role 与绑定信息
  students/       学员 CRUD
  packages/       课包与充值
  sessions/       课程 CRUD、状态变更
  recurrences/    循环课生成与管理
```

部署：用微信开发者工具打开项目根目录，右键各云函数目录 → 上传并部署（云端安装依赖）。
