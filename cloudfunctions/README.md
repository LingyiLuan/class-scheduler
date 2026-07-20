# 云函数（后端）

微信云开发云函数根目录（`project.config.json` 的 `cloudfunctionRoot`）。小程序端不直接读写云数据库，
所有数据操作经此处云函数，云函数内用 `cloud.getWXContext()` 取 openid、查 `users` 得角色后校验权限。

## 目录结构

```
cloudfunctions/
  _shared/          共享工具（源，仅此一份被提交）
    auth.js         身份校验：getContext / requireRole
    resp.js         统一返回：ok / fail
  _sync-shared.js   把 _shared 复制进各函数目录的脚本
  login/            登录，查/建 users，返回 role/isActive/boundStudentIds
    index.js
    package.json    依赖 wx-server-sdk
  （students / packages / sessions / recurrences 见指令三）
```

## 统一约定

- 除 `login`（身份入口，用户可能尚未建档）外，每个函数入口先走 `auth.requireRole(...)` 校验。
- 返回格式：成功 `{ code: 0, data }`，失败 `{ code: <非0>, msg }`。前端 `src/services/api.ts` 据此解包。
- 所有写操作记录操作者 openid（`ownerId`）。
- 课时变动须在事务中完成，流水与状态同时更新（在 `sessions`/`packages` 中实现，指令三）。

## _shared 的引入方式（重要）

云函数各自独立打包上传，**无法** `require('../_shared/...')`（上级目录不随函数上传）。
因此采用**同步复制**：

1. `_shared` 源只维护一份在 `cloudfunctions/_shared/`。
2. 部署前运行 `pnpm sync:cloud`，脚本把 `_shared` 复制进每个函数目录下的 `./_shared/`。
3. 函数内以 `require('./_shared/auth')` 引用。
4. 复制产物 `cloudfunctions/*/_shared/` 已在 `.gitignore`，不提交，避免重复。

> 不用 npm link / `file:` 依赖：二者都指向函数目录之外，云端安装依赖时不存在，会失败。复制是唯一可靠方式。

## 部署步骤

前置：已按 [../docs/cloud-setup.md](../docs/cloud-setup.md) 开通云开发、创建集合与索引。

1. 同步共享代码：

   ```bash
   pnpm sync:cloud
   ```

2. 在微信开发者工具打开**项目根目录**，确保工具栏「环境」选中你的云开发环境。
3. 对每个要部署的函数目录（如 `login`）右键 → **上传并部署（云端安装依赖）**。
   云端会依据该函数的 `package.json` 安装 `wx-server-sdk`。
4. 部署后可在「云函数 → 测试」里调用 `login` 验证：首次返回 `{ code:0, data:{ role:'owner', isActive:true, ... } }`。

> 改动 `_shared` 后必须重新 `pnpm sync:cloud` 并重新上传相关函数。
