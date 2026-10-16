# Life Dashboard · 生命驾驶舱

## 范围

默认首页 `/` 跳转 `/dashboard`，展示五个区域：生命状态、今日重点、伙伴建议、知识库状态、成长记录。
Dashboard 是只读聚合视图，不实现目标/项目/任务的编辑和完成按钮，不修改 Companion 或 Obsidian 的核心逻辑。

## 数据模型

此前 D 盘项目只有 UserProfile 和 Obsidian 索引，没有 Goal / Project / Task / Memory。
本次新增最小模型：Goal → Project → Task，四张表都关联 profile_id。
Memory 的 kind 为 stage / status / review，用于当前阶段、最近状态和复盘。
UserProfile 原字段保持不变，档案 JSON goals 保留原用途。
核心目标优先取 Goal 表中首个 active 目标，没有时回退到 UserProfile.goals 的第一条。

模型只通过新增表扩展 SQLite，不重建或清空原有档案、聊天相关逻辑和 Obsidian 索引。

## API

`GET /api/dashboard`

```json
{
  "profile": {"id": 1, "name": "演示用户", "current_stage": "探索与验证", "core_goal": "完成一个小作品", "recent_status": "专注于一个小行动"},
  "goals": [],
  "projects": [],
  "tasks": [],
  "ai_insight": "本地模拟建议",
  "ai_suggestions": [],
  "ai_status": "ok",
  "ai_provider": "mock",
  "knowledge": {"files_count": 0, "last_sync": "", "connected": true, "sync_status": null},
  "progress": {"total": 0, "completed": 0, "percentage": 0},
  "growth": {"completed_tasks": [], "reviews": []},
  "current_date": "2026-10-15",
  "timezone": "Asia/Shanghai",
  "demo_data": true
}
```

示例数组省略内容。goals/projects 最多各 50 条；tasks 只返回上海时区的今日到期任务。
进度 = 今日任务中 done 数量 / 今日任务总数，没有任务时为 0%。不把明天的任务纳入今日进度。
成长记录返回最近五条有完成时间的 done 任务，以及最近三条 review。
档案缺失返回 404，数据为空时显示诚实的空状态。

聚合通过 profile_id 过滤目标、项目、任务和 Memory，并检查项目所属目标与任务所属项目的归属。
这不是完整认证系统；当前仍固定使用演示档案 1。
知识计数只取当前配置 Vault 的 active Source；last_sync 来自 VaultSync，不触发新扫描。

伙伴建议复用现有 CompanionAgent，通过问题传入当前目标、项目、今日任务、进度和最近复盘。
当前模型仍为本地规则 mock，不等于真实 AI 推理。摘要前附实际任务统计。
建议超时或失败时，其他卡片仍可展示；GET 不创建任务、修改状态或生成成长记录。

## 测试数据

`backend/data/demo_dashboard.json` 包含两项目标、两个项目、五个任务以及阶段、状态和复盘。
首次启动时，若档案 1 的四张新表都没有数据，则一次性插入虚构样例，并标记 is_demo。
示例今日任务三个，初始完成一个，进度 33%。页面明确显示“演示数据”。
后续启动不覆盖数据、不把任务日期自动挪到今天。跨天后今日任务数量变化是正常的，样例不伪装为真实进展。
如果已有任意目标、项目、任务或 Memory 数据，则跳过全部样例初始化，避免混入真实记录。

## 页面结构与截图状态

页面顶部为 Life OS 品牌、Personal Life Operating System、深色生命驾驶舱标题区、日期及刷新按钮。
大屏采用两列卡片，小屏自动切换为单列；下方成长记录区分完成任务与复盘。
使用深蓝灰、白色和绿色，少量圆环装饰，不依赖图片、外部字体或图标服务。
模块组件：LifeCard、TaskCard、InsightCard、KnowledgeCard。
卡片提供伙伴与知识库导航，任务勾选图形仅表示状态，不可点击更改状态。
请求加载、错误重试、AI 降级、空列表和上次成功数据保留均有明确提示。

2026-10-15 已请求并获得用户重新授权，但 Browser Use 仍返回 saved permission setting blocks this action。
因此未生成真实截图，也没有用替代浏览器或模拟图片绕过限制。
布局描述仅是实现说明，不能视为截图验收证据。需要用户在应用中解除已保存的浏览器拒绝规则后再截图。

## 启动与验证

双击 `<LIFE_OS_ROOT>/code/life-os/Start-LifeOS.cmd`，访问 http://127.0.0.1:5173/ 。
如果旧服务尚未加载新增路由，先双击 Stop-LifeOS.cmd，再双击 Start-LifeOS.cmd。

```powershell
cd <LIFE_OS_ROOT>\code\life-os\backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd ..\frontend
npm run build
Invoke-RestMethod http://127.0.0.1:5173/api/dashboard
```

Dashboard 测试覆盖聚合格式、上海日期、今日进度、全完成、空列表、样例不覆盖、最近状态、跨档案隔离、有效知识计数、AI 降级和 GET 无写入。
测试使用临时 SQLite 和 Vault，不修改用户数据。
