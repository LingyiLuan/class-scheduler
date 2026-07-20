# class-scheduler

英语工作室的排课与学员管理 **微信小程序**。一期只做老师端，单用户使用，不涉及支付与学生端。
产品方案见 [docs/plan.md](docs/plan.md)，开发规范见 [docs/dev-guide.md](docs/dev-guide.md)，
排课规则见 [docs/scheduling-rules.md](docs/scheduling-rules.md)，数据集合见 [docs/schema.md](docs/schema.md)。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Taro 3.6 + React 18 + TypeScript（Webpack5） |
| UI | @nutui/nutui-react-taro |
| 后端 | 微信云开发 · 云函数（Node.js） |
| 数据库 | 微信云开发 · 云数据库（文档型） |
| 登录 | 微信 openid（云函数 getWXContext） |
| 日期 | dayjs |
| 包管理 | pnpm |

## 架构

```
微信小程序（Taro + React + TS）
      ↓ wx.cloud.callFunction（经 src/services/api.ts 封装）
云函数（cloudfunctions/，Node.js）  ← 后端，身份与权限判断在此
      ↓
云数据库（文档型，仅管理端可读写）
```

小程序端**不直接读写数据库**，所有操作经云函数。云函数用 `cloud.getWXContext()` 取 openid、
查 `users` 得角色后校验权限。

## 为什么用微信云开发（不用 Supabase / 自建后端）

- 微信小程序要求所有网络请求域名完成 **ICP 备案**；Supabase 是境外域名无法备案，上线会被合法域名校验拦截。
- 自建后端需服务器 + 域名 + 备案（7–20 工作日），成本与周期当前不接受。
- 微信云开发**免备案、免服务器**、免费额度充足，云函数即后端，AppSecret 与业务逻辑均在服务端。
- 代价：数据层绑定微信生态；二期若做 Flutter App，需通过 HTTP 云函数暴露 API 或迁移。

## 目录结构

```
src/
  pages/        页面
  components/   通用组件
  services/     云函数调用封装（api.ts + 各业务模块）
  hooks/        自定义 hooks
  utils/        纯函数工具
  types/        TypeScript 类型
  constants/    枚举与常量
cloudfunctions/ 云函数（后端）
docs/           方案、规范、排课规则、集合设计
```

## 本地启动

1. 安装依赖：`pnpm install`
2. **开通云开发**：微信开发者工具 → 云开发 → 开通 → 免费套餐 → 记下环境 ID。
3. 配置环境变量：复制 `.env.example` 为 `.env`，填入 `TARO_APP_CLOUD_ENV=<环境ID>`
   （或直接改 `src/constants/cloud.ts` 的兜底值）。
4. 编译到微信小程序：`pnpm dev:weapp`（watch）或 `pnpm build:weapp`（单次）。产物在 `dist/`。
5. 用微信开发者工具打开**项目根目录**（AppID 已配置在 `project.config.json`，`miniprogramRoot` 指向
   `dist`，`cloudfunctionRoot` 指向 `cloudfunctions/`）。云函数右键「上传并部署」。

## 脚本

- `pnpm dev:weapp` / `pnpm build:weapp` — 编译到微信小程序
- `pnpm lint` / `pnpm lint:fix` — ESLint 检查
- `pnpm format` — Prettier 格式化
- `pnpm test` — Jest 单测
