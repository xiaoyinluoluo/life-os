# Agent Tool Layer · Life OS v0.1

## 当前范围

工具执行真实操作本地 SQLite；模型建议和行动编排仍使用本地模拟实现。未接入真实 AI、没有网络上传、不新增向量数据库、不写入任何 Obsidian 原始文件，也没有删除工具。

Companion 保留原 `/api/companion/chat` 聊天协议。新行动入口为独立预览与确认接口，避免原聊天请求意外创建数据。比赛类目标生成 1 个项目和 5 个任务；通用目标结合模拟模型建议生成 5 个步骤。日期按上海日期逐日建议，不代表真实比赛的截止日期。

## 模块与接口

- `backend/app/tools/base.py`：Tool.name / description / parameters / execute，Pydantic 参数校验、写入授权、审计与执行序号验证。
- `tools/registry.py`：统一注册、描述及调用，不依赖模型 SDK。
- `services/tool_actions.py`：固定方案、凭据、事务、幂等和取消。原始凭据只返回预览响应一次，数据库保存 SHA-256 摘要。
- `models/tool_execution.py`：ToolProposal / ToolExecutionLog。
- `schemas/tool_actions.py`：API 输入契约，拒绝未知字段。
- `agents/companion.py`：通过注册表获取档案和知识，并获取可用工具列表；执行写入的权限不能由模型授予。

新增工具时继承 Tool、定义 input_model 与 `_execute`，在 registry 注册。写入工具设置 `requires_confirmation=True`，同时在受控方案生成器中加入可预览的操作；不得提供跳过确认的 API 或由模型传入授权上下文。工具不自行 commit，由确认服务统一提交。

| 工具 | 输入 | 输出要点 | 用户确认 |
| --- | --- | --- | --- |
| get_profile | `{}` | id、name、background、skills、interests、values、goals | 无需 |
| search_knowledge | query，limit=3（1–5） | items：source_id、file_name、summary、tags、match | 无需 |
| create_project | goal_id、title、description（可选） | success、project_id、message | 必须 |
| create_task | project_id、title、description、priority、due_date（后 3 项可选） | success、task_id、project_id、message | 必须 |
| update_task | task_id，至少一个 status / priority / due_date | success、task_id、status、priority、due_date、message | 必须 |

ID 使用当前 SQLite 整数主键。priority：low / medium / high；status：todo / in_progress / done；日期：YYYY-MM-DD。update_task 的 due_date=null 会清空截止日期，缺省字段保持原值。任务完成设置 completed_at；重新打开清空它。

知识搜索复用现有有效 Vault 索引，搜索文件名、标签和摘要，最多考察最近 2000 条索引。没有关键词匹配时返回明确标注 `match=recent_fallback` 的近期摘要；这不表示语义匹配。已删除的索引及其他 Vault 的数据不参与检索。

## API 参考

默认后端地址：http://127.0.0.1:8000，交互文档 `/docs`。默认用户固定 profile_id=1，无登录鉴权，仅限本机。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /api/tools | 工具 JSON Schema 列表 |
| POST | /api/tools/{tool_name}/execute | 直接读取工具；直接写入返回 403 |
| GET | /api/tools/logs?limit=50 | 本地审计，limit 1–200 |
| GET | /api/companion/goals | 当前可选的 active 目标 |
| POST | /api/companion/actions/preview | 读取背景并生成待确认方案 |
| GET | /api/companion/actions/{id} | 方案状态及已创建计划，不返回凭据 |
| POST | /api/companion/actions/{id}/confirm | 确认并原子执行固定方案 |
| POST | /api/companion/actions/{id}/cancel | 取消 pending 方案 |

### 1. 读取资料和搜索

```http
POST /api/tools/get_profile/execute
Content-Type: application/json

{"arguments":{}}
```

```http
POST /api/tools/search_knowledge/execute
Content-Type: application/json

{"arguments":{"query":"AI Agent 比赛","limit":3}}
```

### 2. 预览创建计划

先 GET `/api/companion/goals` 选择已有目标，以下 goal_id=1 仅为示例：

```http
POST /api/companion/actions/preview
Content-Type: application/json

{"message":"我想参加 AI Agent 比赛，帮我规划一下。","goal_id":1}
```

响应包含 id、status=pending、analysis、summary、operations、expires_at、confirmation_token、steps 和 result=null。operations 展示每项工具和固定参数；任务内的 `$created_project` 仅引用这次方案先创建的项目，由服务端解析，不是任意代码。

预览本身不会写入 Project / Task；会保存方案及读取审计。message 上限 4000 字符。方案有效期 30 分钟。

### 3. 明确确认

必须先将完整 operations 展示给用户并取得其确认。不要在拿到预览响应后自动执行下一步。

```http
POST /api/companion/actions/{id}/confirm
Content-Type: application/json

{"confirmation_token":"预览响应中的凭据","confirmed":true}
```

响应示例（ID 仅作示意）：

```json
{
  "success": true,
  "proposal_id": "方案ID",
  "message": "行动计划已创建",
  "project_id": 3,
  "task_ids": [7, 8, 9, 10, 11],
  "already_executed": false,
  "plan_url": "/planning?plan_id=方案ID",
  "outputs": [{"tool_name":"create_project","output":{"success":true,"project_id":3,"message":"项目已创建"}}],
  "steps": [{"label":"创建项目","status":"success"}]
}
```

实际 outputs / steps 包含全部六项操作。相同方案凭据重试返回原结果并设置 already_executed=true，不重复创建。网络中断后前端先查询状态，不自动再发写请求；若仍 pending，可以人工再次确认。

### 4. 取消

POST `/api/companion/actions/{id}/cancel`，请求 `{"confirmation_token":"预览响应中的凭据"}`。仅 pending 可取消，不会删除已经创建的数据。

### 5. 预览修改任务

```http
POST /api/companion/actions/preview
Content-Type: application/json

{"message":"将该任务标记完成并提高优先级","action_type":"update_task","task_id":1,"changes":{"status":"done","priority":"high","due_date":"2026-11-01"}}
```

同样返回单项操作预览，必须使用该预览的凭据确认后才更新。此版本只提供 API 的任务更新入口，前端主流程是新建行动计划。

### 错误与状态

- 403：未确认、确认凭据不符、绕过确认直接写入。
- 404：工具、目标、项目、任务或方案不存在 / 不属于当前档案。
- 409：并发执行、方案过期 / 取消 / 失败 / 内容被改变，或目标 / 项目状态不可用。
- 422：参数、日期、优先级、状态或额外字段不合法；confirmed 必须是布尔值。
- 502 / 504：模拟模型输出异常 / 分析超时，未创建执行方案。
- 执行内部异常返回安全错误，整批项目 / 任务回滚；原始异常文本不回传。

持久状态：pending → executed / cancelled / expired / failed。executing 仅存在于未提交的确认事务内。GET 不会为了过期状态写库，过期判断在确认时执行。

## 确认边界与审计

确认接口只接受凭据和 confirmed=true，不接受新的操作参数。它校验方案归属、有效期及操作摘要，然后逐项校验工具名、参数和顺序。单进程互斥 + SQLite BEGIN IMMEDIATE 防止并发重复写入。项目、任务、成功审计及方案结果同一事务提交；失败时业务数据全部回滚，另记失败 / rolled_back 审计。

工具内部每次写入都检查执行授权，而非仅隐藏前端按钮。没有删除工具，没有笔记写回能力，也不会未经确认批量修改任务。现有档案固定为 1，凭据用于绑定一次确认，不替代用户认证；未来多用户需加入登录、会话、CSRF 与权限校验。

ToolExecutionLog 字段：id、profile_id、proposal_id、agent_name、tool_name、input、output、execution_status、created_at。所有日志在本地 SQLite，时间使用 UTC。读取日志也包含档案和知识摘要，不包含确认凭据。不自动清理审计历史。模型真实上传、日志脱敏 / 保留策略应在未来正式接入时单独设计。

## 数据库兼容

启动 create_all 新建 tool_proposals / tool_execution_logs；固定白名单的增量升级为已有 projects 加 description，为 tasks 加 description / priority（默认 medium），不会删表、清表或覆盖旧数据。此次更新应用前会备份数据库；之后日常启动不会自动备份。升级测试验证旧记录保留与重复运行。

当前没有 Alembic 版本迁移、多用户认证、向量检索或真实模型工具循环，这些作为后续扩展，不在本次进行大规模重构。

## 运行与验证

使用项目根目录 `Start-LifeOS.cmd`，或按根 README 分别启动前后端。打开 http://127.0.0.1:5173/companion ，输入比赛目标 → 选择目标 → 预览 → 核对 → 确认 → 查看计划。按取消、刷新及重复确认分别检查边界；刷新会丢失内存中的待确认凭据，需要重新生成方案。

```powershell
cd <LIFE_OS_ROOT>\code\life-os\backend
.\.venv\Scripts\python.exe -m unittest tests.test_tools -v
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd <LIFE_OS_ROOT>\code\life-os\frontend
npm run build
```

测试使用临时 SQLite 和临时 Vault，不改变实际用户数据库，不调用真实模型或外部服务。覆盖用户要求的六个核心场景，另覆盖直接绕过、重复确认、凭据混用、方案篡改、过期 / 取消、失败回滚、任务更新、所有权校验、并发互斥及旧表升级。
