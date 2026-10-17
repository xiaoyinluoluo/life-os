# Life OS 云端版

## GitHub Pages + Supabase

`web/` 是可部署到 GitHub Pages 的静态网页，`supabase/functions/life/` 是保存数据的 Edge Function。网页登录使用 Supabase Auth。项目公开网址为 `https://xiaoyinluoluo.github.io/life-os/`。本机开发在 `web/` 运行 `npm ci` 和 `npm run dev`，先按 `.env.example` 创建不提交的 `.env.local`。GitHub Actions 从仓库变量读取公开的 Supabase URL 和 anon key；两者会进入网页构建结果，不能充当秘密。数据库权限由 `supabase/migrations/` 中的 RLS 控制。服务端密钥绝不能放入网页或 GitHub 仓库。

Supabase Auth 的 Site URL 需设置为上述 Pages 网址，以便注册验证邮件正确返回。网站与原 Sites 版本互不迁移数据；账号需要在新网页注册。当前个人数据表为空，不会自动读取本机档案和 Obsidian。

以下说明保留原 Sites 版本的背景与运行方式。

基于 Sites / Vinext，使用 ChatGPT 登录与 Cloudflare D1 保存每个账号的数据。与本机 FastAPI 版本独立，不会自动导入电脑上的档案、数据库或 Obsidian。

功能：档案、目标、确认后创建项目与任务、任务完成状态、每日复盘、规则模拟伙伴、手动上传 Markdown/纯文本笔记、搜索笔记、JSON 数据导出。所有用户数据由服务端按稳定账号 ID 隔离。当前没有真实 AI 模型调用；不需要 API Key。聊天保留最近 80 轮，文字空间上限约 800 KB。

每 30 秒与页面重新获得焦点时刷新云端状态；编辑中暂缓自动刷新以保留输入。服务端版本比较避免多设备同时修改时静默覆盖。数据备份可导出，但尚无导入/自动备份或本机数据库迁移。

开发：安装依赖后运行 `npm run db:generate`、构建、按 starter 说明应用本地 D1 迁移，再运行 `npm run dev`。本地登录仅用于开发，由 starter 提供。生产身份由 Sites 平台注入，API 拒绝未登录用户和跨站写入。生产构建不包含本地模拟登录。

验证：`node --test tests/life-model.test.mjs`、`npx tsc --noEmit`、集成本地 API 和浏览器检查。保留 Sites 构建插件和身份辅助模块。

## 托管边界

GitHub 仓库负责保存和公开源码。GitHub Pages 只运行静态前端，不能直接运行本项目的 `/api/life` 接口或云端数据库，也不能单独实现 ChatGPT 登录与跨设备同步。

本源码使用 Sites / Vinext 的 Cloudflare Worker 构建与 D1 数据库绑定，并依赖 Sites 平台注入已登录用户身份。迁移到其他托管平台时，需要接入真实登录身份、按账号授权、配置数据库及部署接口，不能信任来自公网客户端自行设置的身份请求头。

为保护现有网站配置，GitHub 中的 `.openai/hosting.json` 不包含已部署网站的项目 ID。首次通过 Sites 部署时由官方工具填写新网站身份；不要把公开源码仓库当成已有生产网站的直接同步副本。

仓库不含账号数据、数据库文件、登录凭据、临时部署令牌或本机测试记录。`tests/api.integration.mjs` 只针对本地预览数据库，不能用于正式网站。
