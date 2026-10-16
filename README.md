# Life OS v0.1

Personal Life Operating System · 个人生命操作系统。

本版本包含生命驾驶舱、Life Companion 模拟聊天、Obsidian 只读索引和需要明确确认的 Agent 工具执行。方案使用本地模拟编排，确认后真实保存项目和任务，不调用真实 AI。

## 目录

```text
<LIFE_OS_ROOT>/
├── code/life-os/
│   ├── frontend/             React + TypeScript + Vite + Tailwind
│   │   └── src/              pages、components、services、hooks
│   └── backend/              FastAPI + SQLAlchemy
│       └── app/              core、models、api、services、agents
├── data/                     SQLite 数据库，首次后端启动时创建
├── docs/                     产品与技术文档
├── obsidian/                 知识库连接预留目录
└── backup/                   备份预留目录
```

## 日常一键启动

项目依赖安装后，双击 `Start-LifeOS.cmd`：后台启动前后端并打开浏览器。
后端使用 `--reload`，修改 Python 后自动重启；Vite 会刷新前端代码。
关闭启动窗口或浏览器不会停止服务；关机、重启、休眠期间不能访问本地页面。
重启电脑后再次双击启动即可，不会丢失 SQLite 数据。

双击 `Stop-LifeOS.cmd` 停止脚本启动的服务。不会删除代码或数据库，也不会停止其他项目。
重复启动会复用已启动的服务。运行日志与进程信息位于项目 `.runtime` 目录，已加入 Git 忽略。
若端口被手动启动的服务占用，请先在原终端按 Ctrl+C 停止该服务。
默认双击脚本不注册开机任务；cmd 里的 Bypass 只作用于当前脚本进程，不修改系统执行策略。

### 登录电脑后自动启动（可选）

在自行运行安装脚本后，Windows 启动文件夹会注册 `Life OS - AutoStart.lnk`，指向本项目的 `scripts/Start-AtLogin.ps1`。
登录电脑后等待几秒，前后端会在后台启动，不自动弹出浏览器。
启动失败会自动重试，日志保存在 `.runtime/autostart.log`。
以后直接访问 http://127.0.0.1:5173/companion ，不需要先打开 Codex 或 VS Code。
同一天重复启动会复用运行中的服务。

本地访问需要电脑处于开机、已登录且未休眠状态。关机、休眠、退出登录时无法使用；这不是网址过期。
该配置不保证应用永不崩溃；如遇故障，可双击 Start-LifeOS.cmd 恢复并检查日志。

查看状态、关闭自动启动或重新启用：

```powershell
cd <LIFE_OS_ROOT>\code\life-os
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Install-Autostart.ps1 -Status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Install-Autostart.ps1 -Disable
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Install-Autostart.ps1
```

自动启动回归测试（会先停止并恢复本项目服务）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File <LIFE_OS_ROOT>\code\life-os\scripts\Test-Autostart.ps1 -RestartServices
```

## 首次环境准备

Node.js 20.19+（本机 24.16.0），Python 3.8+（长期开发建议 3.12 或 3.13）。
依赖版本兼容本机 Python 3.8。前后端独立启动，需要两个 PowerShell 终端。

## 启动后端

```powershell
cd <LIFE_OS_ROOT>\code\life-os\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

环境文件可选，不创建也使用默认路径。不要将 .env 提交到 Git。
若端口 8000 被已有 Demo 占用，关闭原有 Demo 或自行换端口，同时修改 frontend/vite.config.ts 的代理目标。
若旧 pip 出现代理相关的 check_hostname 错误，可仅在该终端设置 `$env:NO_PROXY='*'` 后，使用 `--index-url https://pypi.org/simple` 重新安装，不需要修改系统配置。

- GET http://127.0.0.1:8000/ → 文本 `Life OS Backend Running`
- GET http://127.0.0.1:8000/health → 系统状态及 SQLite 连接结果
- API 文档：http://127.0.0.1:8000/docs
- 默认数据库：<LIFE_OS_ROOT>/data/life_os.db

## 启动前端

```powershell
cd <LIFE_OS_ROOT>\code\life-os\frontend
npm ci
npm run dev
```

访问 http://127.0.0.1:5173 。若 5173 已占用，需要先停止占用它的 Demo。

页面路径：`/dashboard` 生命驾驶舱、`/companion` AI 生命伙伴、`/planning` 行动计划、`/knowledge` 知识库。
默认前端通过 `/api` 代理请求后端；VITE_API_BASE_URL 也可指定独立后端地址。
生产构建 `npm run build`；生产环境需配置 SPA 路由回退和 API 反向代理，Vite 开发代理不包含在 dist 中。

## 扩展入口

- services/dashboard_service.py：聚合档案、目标、项目、今日任务、成长记录及知识索引。
- models/goal.py、project.py、task.py、memory.py：驾驶舱数据结构；项目与任务通过工具层的方案确认接口写入。
- tools/：统一 Tool 接口、参数校验、注册表与五项内部工具。
- services/tool_actions.py：方案预览、授权校验、事务执行、取消与幂等处理。

- models/user.py：最小用户模型；启动创建 users 表，暂无用户 API。
- services/database.py：SQLAlchemy 引擎、会话与初始化。
- agents/companion.py：获取档案、构建系统提示词、调用模型接口、验证结构化输出。
- services/ai/base.py：可替换模型协议；mock.py 是本地模拟实现，registry.py 选择模型。
- integrations/obsidian/obsidian_reader.py：只读 Markdown 扫描与元信息提取。
- services/sync_service.py：增量索引、软删除、历史与同步结果。
- services/knowledge.py：伙伴摘要检索与未来向量检索协议。
- core/config.py：加载后端 .env，统一配置。

未实现登录、聊天历史持久化、真实模型自主规划、自动备份、笔记写回或真实模型调用。
先完成启动验证，再逐步扩展功能。产品文档在 <LIFE_OS_ROOT>/docs 中。

## Life Companion

访问 `/companion`，输入问题后点击发送。结果包含分析、建议和下一步行动。
页面内对话暂存于内存；离开页面或刷新后清空。每次请求独立分析，不携带之前的对话。

`UserProfile` 表名为 `user_profiles`，字段为 id、name、background、skills、interests、values、goals、created_at。
skills、interests、values、goals 使用 JSON 字符串数组；created_at 创建时使用 UTC。
SQLite DateTime 读取后不携带时区，后续对外暴露时间时须按 UTC 序列化。
现有 users 表保持不变。启动通过 SQLAlchemy 创建新增表，不清空已有数据库。工具层另使用固定字段的增量升级为旧 projects 增加 description、旧 tasks 增加 description / priority，保留旧记录。正式长期迁移后续应采用 Alembic。

当前固定读取档案 1。第一次启动插入 `backend/data/demo_profile.json` 中的虚构数据，后续启动不覆盖已保存的档案。
修改 fixture 不会自动覆盖已有数据；目前没有档案编辑 API，也没有用户身份验证。

### API

```http
POST /api/companion/chat
Content-Type: application/json

{"message":"我最近学习很迷茫，应该从哪里开始？"}
```

```json
{
  "analysis": "基于演示档案的模拟分析",
  "suggestions": ["建议一", "建议二"],
  "next_actions": ["下一步行动"]
}
```

消息最大 4000 字符，空白消息返回 422；档案缺失返回 404，模型输出格式不正确返回 502，响应超时返回 504。
Vite 对 `/api/companion/*` 保留路径，对健康检查 `/api/health` 转发为后端 `/health`。
如配置独立后端地址，VITE_API_BASE_URL 应为后端 origin，例如 `http://127.0.0.1:8000`。

### 可替换模型入口

未来在 `backend/app/services/ai/` 添加 `ModelClient` 的真实模型适配器，并在 registry 注册。
Agent 不依赖供应商 SDK；此版本没有 API Key 字段、OpenAI SDK 或任何模型网络请求。
用户档案作为结构化数据放入系统提示词，用户问题独立传入模型。

同步 Obsidian 后，伙伴还会加入最多三条有效索引摘要作为背景。当前只有本地关键词检索与明确标注的近期笔记回退，不是向量检索或真实 AI 理解。

## Obsidian 知识库

默认授权读取目录：`<LIFE_OS_ROOT>/obsidian`。真实 Vault 需要你在 backend/.env 中配置：

```dotenv
LIFE_OS_OBSIDIAN_PATH=<YOUR_VAULT_PATH>
```

重启前后端后，打开 `/knowledge`，核对目录，再点击“同步知识库”。读取与索引不会修改 Markdown，也不会上传用户数据。
新增和修改在每次手动同步中自动识别；删除只标记状态，保留索引历史。没有后台监听或自动扫描。
完整说明见 [Obsidian 集成文档](docs/obsidian.md)。

## 生命驾驶舱

默认首页 `/` 会跳转到 `/dashboard`，通过 `GET /api/dashboard` 加载数据。
五个区域为个人生命状态、今日重点、AI 伙伴建议、知识库状态、成长记录。
当前示例在首次初始化时提供目标、项目、任务与复盘，并在页面标注“演示数据”。
已有记录不会被样例覆盖；样例日期不会随重启改变。完成进度按上海时区的今日任务计算。
驾驶舱只读，不实现任务编辑或打勾完成，也不会修改笔记或触发索引同步。
AI 仍为 mock，失败时其余卡片继续显示。
详细数据结构、截图限制与测试说明见 [Dashboard 文档](docs/dashboard.md)。

### 测试

```powershell
cd <LIFE_OS_ROOT>\code\life-os\backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

自动测试使用临时 SQLite，覆盖 API 格式、输入验证、演示数据不覆盖、档案提示词、404/502/504，以及原有根接口、健康检查和 CORS。
不修改 `<LIFE_OS_ROOT>\data\life_os.db`，也不调用真实模型。

仅测试工具层：在 backend 目录运行 `.\.venv\Scripts\python.exe -m unittest tests.test_tools -v`。测试覆盖读取档案、搜索索引、确认后创建项目及任务、未确认拒绝、修改任务、幂等、过期 / 取消、参数篡改、越权引用、并发保护、批量回滚和旧数据库增量升级。

前端检查：

```powershell
cd <LIFE_OS_ROOT>\code\life-os\frontend
npm run build
```

运行前后端后，可用 PowerShell 手动测试：

```powershell
$body = @{message='我想探索学习方向'} | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8000/api/companion/chat -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

## Agent 工具层

在 `/companion` 输入“我想参加 AI Agent 比赛，帮我规划一下。”，选择归属目标，点击“规划并预览行动”。页面展示档案读取、知识搜索、分析及 1 个项目 / 5 个任务的完整参数；日期为建议安排，需自行核对比赛的真实截止日期。

核对后点击“确认执行以上操作”，才会在 SQLite 中保存项目和任务。点击“查看计划”进入 `/planning?plan_id=...` 查看已保存内容。仅发送聊天消息不会触发写入；取消方案也不改变项目和任务。预览和读取会保存本地审计元数据。

可用工具：`get_profile`、`search_knowledge`、`create_project`、`create_task`、`update_task`。读取可直接执行；写入必须经过服务端保存方案 → 展示参数 → 明确确认，不能用普通工具接口直接写入。任务更新目前提供 API，允许修改 status、priority、due_date；未增加独立任务编辑页面。

方案 30 分钟有效，确认绑定方案与参数，重复确认返回原结果，整批操作失败则回滚。确认凭据只保存在当前页面内存，不放 URL 或日志；刷新 / 离开页面会丢失待确认凭据，可重新预览。执行结果已落库后，可保留“查看计划”的链接。当前固定档案 1，仅面向本机单人使用，确认机制不能代替登录认证。

API、请求样例、扩展方式与边界见 [Agent 工具层文档](docs/agent-tools.md)。交互式 API 文档位于 http://127.0.0.1:8000/docs 。工具日志包含个人资料和笔记摘要，只保存在本地 SQLite，未来接入真实模型前需另行设计上传授权与日志保留策略。

## GitHub 源码包配置

本仓库不包含任何 `.env*` 文件、个人数据库、Obsidian 笔记、日志、依赖目录或构建产物。依赖安装后可按上文启动。文中的 `<LIFE_OS_ROOT>` 是由你选择的运行数据根目录，`<YOUR_VAULT_PATH>` 是由你选择的知识库目录，使用命令前请替换。

后端 `.env` 可自行创建，设置 `LIFE_OS_ROOT` 为运行数据根目录的绝对路径，必要时设置 `LIFE_OS_OBSIDIAN_PATH`。不配置时，现有代码默认使用源码根目录上两级目录作为运行根目录；SQLite 位于该目录的 `data/life_os.db`。前端不需要 `.env`，默认通过本地代理访问后端。

## 公开源码说明

这是单用户本地演示项目，AI 为 mock，尚无登录鉴权与生产部署配置。当前尚未附加开源许可证；公开源码不代表已经授予使用、修改与分发许可，许可证应由项目所有者另行确定。
