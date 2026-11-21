# Life OS v0.1

## 本机使用说明

本机版在 Windows 上双击 `Start-LifeOS.cmd` 启动，然后访问 http://127.0.0.1:5173/ 。使用完成后可双击 `Stop-LifeOS.cmd` 停止服务。依赖已安装在当前副本中；如移动或重新下载项目，需重新安装 Python 和前端依赖。

首页“今天”支持新增任务、修改标题和日期、标记完成、撤销状态修改以及保存任务复盘。可按今天、逾期、未安排、以后、已完成或全部筛选。复盘跟随任务保存在本机，刷新页面后仍可查看和修改。

首次使用可填写称呼并选择“使用个人模式”，隐藏演示内容并保留已有个人任务；也可选择“查看示例”。“使用设置”可重新选择。“个人档案”用于编辑个人资料。

首页可从待办选出当天最多两项重点。“逾期”支持批量改到今天、取消日期或归档，归档后可恢复。去“行动计划”建立目标、填写想看到的结果，并记录实际进展和方向调整。暂停或结束目标时，未完成任务移到首页“搁置”，恢复推进后按原日期显示。可在目标页安排下一步，也可在首页创建或编辑任务时指定目标。

数据保存在本项目的 `data/life_os.db`。升级前的数据库备份位于 `backup/`。生命伙伴可在本机配置 GPT，详见下文。知识库需配置 Obsidian 路径。

本机版仅供本电脑的单用户使用，不提供登录或跨设备同步。电脑关机或休眠时无法访问。不要将本地服务开放到公网。

Personal Life Operating System · 个人生命操作系统。

在线云端版：[打开 Life OS](https://xiaoyinluoluo.github.io/life-os/)。使用邮箱注册并登录后，档案、目标、任务、复盘、笔记和对话保存在 Supabase，可在不同设备登录同一账号访问。云端版源码和部署说明见 [`cloud/README.md`](cloud/README.md)。以下运行说明主要针对原有本地版；本地 SQLite 数据和 Obsidian 文件不会自动上传到云端。

本版本包含生命驾驶舱、支持 GPT 的 Life Companion 聊天、Obsidian 只读索引和需要明确确认的 Agent 工具执行。行动方案使用本地规则生成，确认后保存项目和任务。

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

本机版为单用户设计。可以在「个人档案」编辑资料，并在首页管理日常任务。
先完成启动验证，再逐步扩展功能。产品文档在 <LIFE_OS_ROOT>/docs 中。

## Life Companion

「AI 生命伙伴」可以在本机通过 OpenAI Responses API 聊天。在 `backend/.env` 填写以下配置，保存后重启 Life OS。密钥只在后端读取。

```dotenv
OPENAI_API_KEY=
LIFE_OS_OPENAI_MODEL=gpt-5.4-mini
```

设置密钥后，页面显示「发送给 GPT」。每次发送会提交当前消息、最近六轮对话和本轮主动选附的一条目标或复盘。完整对话保存在本机数据库，可以在聊天页清空。本机模拟、首页建议和行动规划沿用原来的本地规则。API 按 OpenAI API 账号单独计费。

也可以在同一文件中配置 `DEEPSEEK_API_KEY` 和可选的 `LIFE_OS_DEEPSEEK_MODEL=deepseek-flash`，重启后在生命伙伴页面选择 DeepSeek。两个服务使用独立的聊天记录和账单，切换服务不会携带另一个服务的历史；每次请求会将当前消息、该服务最近六轮聊天和主动选附资料发给所选服务。两种对话可分别清空。

还可以配置火山方舟的 `ARK_API_KEY` 和 `LIFE_OS_DOUBAO_MODEL`，重启后选择豆包。默认模型为 `doubao-seed-2-1-pro-260915`，也可填写账号已开通的模型 ID 或推理接入点 ID。豆包聊天独立保存，每次请求会将当前消息、豆包最近六轮聊天和主动选附资料发给火山方舟。

访问 `/companion`，输入问题后点击发送。结果包含分析、建议和下一步行动。
本地模拟的对话暂存在页面内存中。每次请求独立分析。

`UserProfile` 表名为 `user_profiles`，字段为 id、name、background、skills、interests、values、goals、created_at。
skills、interests、values、goals 使用 JSON 字符串数组；created_at 创建时使用 UTC。
SQLite DateTime 读取后不携带时区，后续对外暴露时间时须按 UTC 序列化。
现有 users 表保持不变。启动通过 SQLAlchemy 创建新增表，不清空已有数据库。工具层另使用固定字段的增量升级为旧 projects 增加 description、旧 tasks 增加 description / priority，保留旧记录。正式长期迁移后续应采用 Alembic。

当前固定读取档案 1。第一次启动插入 `backend/data/demo_profile.json` 中的虚构数据，后续启动不覆盖已保存的档案。
修改 fixture 不会自动覆盖已有数据；可通过「个人档案」编辑资料。

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

### 本地模拟接口

原有的 `POST /api/companion/chat` 用于本地模拟。它在本机读取档案和索引。GPT 聊天使用独立的 `/api/companion/conversation`，只读取本轮选附的个人资料。

同步 Obsidian 后，本地模拟还会加入最多三条索引摘要。检索使用本地关键词，无法匹配时会标注近期笔记作为备用背景。

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
驾驶舱只读；可在“我的生活”新增任务和标记完成。驾驶舱不会修改笔记或触发索引同步。
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

后端 `.env` 可自行创建，设置 `LIFE_OS_ROOT` 为运行数据根目录的绝对路径，必要时设置 `LIFE_OS_OBSIDIAN_PATH`。不配置时，默认使用本仓库根目录；SQLite 位于该目录的 `data/life_os.db`。前端不需要 `.env`，默认通过本地代理访问后端。

## 公开源码说明

这是单用户本地项目，尚无登录鉴权与生产部署配置。当前尚未附加开源许可证；公开源码不代表已经授予使用、修改与分发许可，许可证应由项目所有者另行确定。

## 云端版源码

[`cloud/`](cloud/) 保存另外实现的云端版：ChatGPT 登录、按账号隔离的 D1 存储、目标任务、每日复盘、规则模拟伙伴和主动导入笔记。原本机版仍保留在仓库根目录的 `frontend/` 与 `backend/`，两者独立运行。详见 [云端版运行及托管说明](cloud/README.md)。

上传 GitHub 不等于完成网站托管。云端版包含服务端接口、身份验证和数据库，不能仅凭 GitHub Pages 完整运行。当前 Sites 网址的访问遇到 Cloudflare 403 拦截；保存源码不会自动解除该访问限制。


## 工作台改进（2026-11-20）

- 生命伙伴可选附当前 Vault 的已索引笔记摘要、个人档案、目标或任务复盘。发送前预览，只会将本轮选中的一项资料与消息发给所选服务；笔记摘要不等于全文。请先同步知识库。
- 回复中的“加入计划”打开可编辑草稿，确认内容、日期与目标后创建任务。同一条回复中的同一项行动重复确认不会重复创建。原本固定五步的本地模拟规划保留在折叠区域。
- 个人模式首页支持每天的可用分钟数、今日任务预计用时和超时提醒；估时仅保存在当天安排，不是实际工时追踪。
- “每周回顾与备份”按上海时间汇总本周完成任务与当前逾期，保存结果、阻碍与下周调整。未完成的任务也可记录阻碍。
- 对话取消最近 100 轮的自动截断；模型仍只收到最近六轮上下文。支持核实、编辑后将回答结论保存为本机长期参考，在每周回顾页查看；暂未实现自动长期记忆和笔记写回。
- 数据库存在时，每天首次启动在 data/backups 下保存一个升级前快照；长时间不重启请手动点击“现在备份”。备份使用 SQLite backup API 并执行完整性检查，包含数据库里的个人资料和聊天，不包含 .env 密钥或 Vault 原文件。备份没有自动清理策略，需留意磁盘空间。
- 恢复：停止 Life OS，另存当前 data/life_os.db 后，将备份复制到该位置，重新启动。自动备份在同一磁盘，重要备份应下载到其他磁盘。

验证使用临时数据库与模拟模型，不发送真实个人资料或产生 API 费用。
