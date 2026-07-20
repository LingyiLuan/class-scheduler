# class-scheduler

英语工作室的排课与学员管理 **微信小程序**。一期只做老师端，单用户使用，不涉及支付与学生端。产品方案见 [docs/plan.md](docs/plan.md)，开发规范见 [docs/dev-guide.md](docs/dev-guide.md)。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Taro 3.6 + React 18 + TypeScript |
| 编译 | Webpack5 |
| UI | @nutui/nutui-react-taro |
| 数据访问 | Supabase（PostgREST，经 `Taro.request` 封装） |
| 数据库 | PostgreSQL（Supabase 托管） |
| 日期 | dayjs |
| 包管理 | pnpm |

## 目录结构

```
src/
  pages/          页面
  components/     通用组件
  services/       数据访问层（Supabase REST 客户端 + 各表 service）
  hooks/          自定义 hooks
  utils/          纯函数工具
  types/          TypeScript 类型
  constants/      枚举与常量
config/           Taro 构建配置
docs/             方案、规范、排课规则、数据库 schema
```

页面不直接调用数据访问接口，一律通过 `services/` 层。

## 关于 Supabase 与小程序的兼容性（重要）

官方 `@supabase/supabase-js` **不能**直接在微信小程序里用：

- `realtime-js` 通过全局 `WebSocket` 构造器工作，小程序只有 `wx.connectSocket`，没有全局 `WebSocket`；
- `auth-js` 依赖 `localStorage`，小程序没有；
- 所有 HTTP 走全局 `fetch`，小程序没有，只有 `wx.request`。

一期不需要 realtime 订阅，也不用 supabase-auth，因此改为在 [src/services/supabaseClient.ts](src/services/supabaseClient.ts) 里用 `Taro.request` 封装 Supabase 的 PostgREST 接口。数据安全依赖数据库端 RLS 策略（见 `docs/schema.sql`），因为 anon key 会被打包进小程序、可被任何人提取。

## 本地启动

1. 安装依赖：

   ```bash
   pnpm install
   ```

2. 配置环境变量：复制 `.env.example` 为 `.env`，填入 Supabase 的 URL 与 anon key。
   注意变量名需带 `TARO_APP_` 前缀，Taro 才会注入小程序运行时。

3. 编译到微信小程序（watch 模式）：

   ```bash
   pnpm dev:weapp
   ```

   或单次构建：`pnpm build:weapp`。产物在 `dist/`。

4. 用微信开发者工具打开项目根目录（AppID 已配置在 `project.config.json`，
   `miniprogramRoot` 指向 `dist`）。发布前需在小程序管理后台把 Supabase 域名
   加入 request 合法域名（本地调试期 `project.config.json` 已关闭 `urlCheck`）。

## 脚本

- `pnpm dev:weapp` / `pnpm build:weapp` — 编译到微信小程序
- `pnpm lint` / `pnpm lint:fix` — ESLint 检查
- `pnpm format` — Prettier 格式化
- `pnpm test` — Jest 单测
