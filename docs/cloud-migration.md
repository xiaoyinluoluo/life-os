# Life OS 云端迁移与恢复

正式入口：<https://xiaoyinluoluo.github.io/life-os/>。电脑和手机使用同一账号登录此入口。旧本机 FastAPI 页面仍使用 SQLite，不能作为同步入口。

## 迁移对应关系

| SQLite 来源 | 云端 `life_records.kind` | ID 与内容 |
| --- | --- | --- |
| `user_profiles` | `profile` | `main`；已有云端档案保留，不覆盖 |
| `goals` | `goal` | 基于本机 ID 的稳定 UUID；标题、状态、结果、决定、示例标记 |
| `projects` | `project` | 稳定 UUID；目标关联、描述、示例标记 |
| `tasks` | `task` | 稳定 UUID；项目关联、日期、优先级、完成状态、复盘、归档、示例标记 |
| `memories` | `note` | 稳定 UUID；记忆文字与示例标记 |
| `companion_chat.turns` | `message` | 每轮对话一条；原数据没有时间时显示“日期未记录” |
| `workbench_records` 中 `experiment:` | `decision` | 稳定 UUID；保留原结构 |
| `sources` 对应的 Obsidian 文件 | `note` | 只有明确指定的文件才读取全文并导出；不自动扫描整个 Vault |

`source_revisions`、`vault_syncs` 和工具执行日志仍保存在本机备份中，不作为云端日常内容。未选择的 Obsidian 文件原文不会上传。

## 本机备份与导出

先关闭本机服务。使用项目 `backend/.venv/Scripts/python.exe scripts/portable_backup.py data/life_os.db --output backup/your-backup.db` 制作 SQLite 备份，再运行同一脚本的 `--verify backup/your-backup.db` 检查完整性、SHA-256 和表计数。`backup/` 已被 Git 忽略。

运行 `backend/.venv/Scripts/python.exe scripts/export_cloud_import.py backup/your-backup.db --output backup/cloud-import.json` 查看字段数量并生成迁移文件。需要同步某篇 Obsidian 笔记时，额外传入 `--vault <Vault目录> --include-note <数据库中对应文件的完整路径>`；每篇都要显式指定。此工具不会删除本机文件或云端记录。文件不存在、越出指定 Vault 或不是 UTF-8 时会报错。

在登录后的线上“个人知识库 → 迁移本机数据”选择 JSON，先看待导入、已存在和冲突数量，再确认只导入缺失记录。稳定 ID 保证重复导入不产生副本；冲突由人决定，不自动覆盖。每次重新导出并上传，可将新增的指定笔记单向送到当前账号。浏览器不会后台读取 Vault。

## 云端备份与恢复

在登录后的线上点击“导出个人数据”，保存 JSON 到私有位置。导出的格式可重新用于“迁移本机数据”：恢复时先登录原账号，上传 JSON，预览并导入缺失记录。已有同 ID 且内容不同的记录会显示冲突，不会被自动覆盖。误删、误改需要先查看冲突及备份内容，再手工决定恢复哪一版。上传的壁纸和字体在私有 Storage 中，不包含在此 JSON 内，需另行保存原文件。

云端迁移前的旧 `life_accounts` 内容保存在仅管理端可读的 `life_accounts_backup_20261122`；分记录补示例标记之前的快照保存在 `life_records_backup_20261122`。不要把这些备份表、导出的 JSON、SQLite、Obsidian 原文件或 API 密钥提交到 GitHub。

## 当前已知限制

目前前端按记录读取，但仍会循环拉取全部分页再渲染；超大列表还需要真正的按需分页 UI。离线时显示连接失败，尚无可靠的待同步写入队列。伙伴对话界面明确为规则模拟，真实 AI 提供商尚未接通。手机真实登录、增删改、断网重连和同时编辑仍须在手机上验收。
