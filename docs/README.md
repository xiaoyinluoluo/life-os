# Life OS 产品与技术文档

## v0.1 范围

生命驾驶舱、AI 生命伙伴、行动计划、知识库四个路由页面；FastAPI API；SQLite + SQLAlchemy。生命伙伴提供模拟聊天，驾驶舱聚合档案、Goal、Project、Task、Memory 和 Obsidian 索引。详细说明见 [dashboard.md](dashboard.md)。

浏览器 → React services/api.ts → FastAPI api/system.py → SQLAlchemy → data/life_os.db。

聊天路径：Companion 页面 → services/companion.ts → POST /api/companion/chat → LifeCompanionAgent → UserProfile + 系统提示词 → ModelClient → analysis / suggestions / next_actions。

Agent 在 backend/app/agents 中通过协议与注册函数替换，模型适配器在 services/ai 中替换。当前只使用 mock，固定档案 1；聊天消息不保存，每次独立请求。Obsidian 已增加只读读取、增量索引和历史，通过 Knowledge 页面手动同步；伙伴使用有效笔记摘要。详细配置与行为见 [obsidian.md](obsidian.md)。备份目录仅预留，不运行自动备份。

Agent 工具层已实现档案读取、知识搜索、创建项目、创建任务、修改任务；写入统一经过预览、明确确认和事务执行。聊天分析仍使用 mock，行动方案为本地模拟编排。完整 API、配置及测试见 [agent-tools.md](agent-tools.md)。

数据库初始化使用 create_all；工具层另添加固定字段的轻量增量升级以保留旧项目和任务。后续正式演进应引入 Alembic 数据库迁移。
默认本机开发，未实现身份认证、多用户权限或生产部署配置。
启动方式见 ../README.md。
