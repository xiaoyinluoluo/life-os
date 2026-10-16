# Obsidian 只读集成

## 授权与配置

第一阶段只读取用户在后端环境配置中指定的目录。API 不接受任意 Vault 路径，不扫描其他目录，不调用真实模型或上传笔记。
默认目录为 `<LIFE_OS_ROOT>/obsidian`；它目前是预留目录，不等于你的实际 Obsidian Vault。

在 `<LIFE_OS_ROOT>/code/life-os/backend/.env` 中填写你授权读取的实际 Vault 根目录：

```dotenv
LIFE_OS_OBSIDIAN_PATH=<YOUR_VAULT_PATH>
LIFE_OS_OBSIDIAN_MAX_FILE_BYTES=1048576
```

如尚无 .env，可复制 backend/.env.example 为 .env。建议 Windows 路径使用 `/`。
修改 .env 后停止并重新启动服务（环境文件修改不会由 Python 代码热重载自动应用）。
然后打开 http://127.0.0.1:5173/knowledge ，核对显示的目录，再点击“同步知识库”。
也可以指定一个独立副本或测试 Vault，避免索引不希望 Life OS 使用的私人笔记。

## 读取行为

- 递归扫描 Markdown，扩展名大小写均支持，只读 UTF-8 / UTF-8 BOM 文本。
- 排除以 `.` 开头的目录和文件，包括 `.obsidian`、`.git`、`.trash`。
- 不跟随符号链接和 Windows junction/reparse point，不读取授权根目录以外的内容。
- 默认单文件上限 1 MiB，超限、不可读、编码错误或读取期间变化的文件会报告错误。
- SHA-256 基于原始文件字节。读取不会写回、重命名或删除任何笔记。
- 标签支持正文 `#tag`、嵌套标签 `#career/ai`，以及 frontmatter 的 `tags: [a, b]`、单值和列表行写法。不是完整 YAML 解析器，不支持 YAML 锚点、多行复杂标签表达式。
- 摘要是正文开头最多 1000 个字符的本地文本提取，去除 frontmatter、代码段和部分 Markdown 标记；不是 AI 摘要。
- 创建/修改时间来自文件系统，统一按 UTC 返回，浏览器转换为本地时间。Windows 提供创建时间；部分其他系统只提供 inode 变更时间，不能将其当作可靠的原始创建时间。
- OS 可能在读取时更新访问时间；文件内容及修改时间不由 Life OS 修改。

## 索引与历史

Source 字段：id、file_name、file_path、content_hash、summary、tags、created_at、updated_at。
额外字段 vault_path 用于区分不同 Vault，status 为 active/deleted，indexed_at 为最近索引变动时间。
created_at/updated_at 对应源文件时间，indexed_at 对应索引处理时间。

新增文件加入索引，hash 或文件时间改变时更新索引；未变化文件不重复新增历史。
完整扫描后，缺失文件只标记 deleted，不删除任何 Source 记录。文件恢复后复用原 Source id，记录 restored 事件。
重命名视为旧路径被删除、新路径被新增。

source_revisions 保留每次新增、修改、删除与恢复时的 hash、摘要、标签和时间快照。
这是索引历史，不是完整 Markdown 版本备份；本模块不保存整篇笔记，也不能还原原文件。
vault_syncs 保存每次完成的同步结果和错误。数据库事务保证索引、历史和同步结果一起提交。

Vault 整体缺失时保持现有索引；部分扫描失败时仍索引成功读取的文件，但本次不标记任何文件删除。
切换 Vault 后，旧 Vault 索引历史保留，列表和伙伴上下文只使用当前配置目录。
当前用户手动触发每次同步，“自动加入/更新”是指单次同步中的增量处理；没有后台文件监听或定时扫描。

## API

`GET /api/obsidian/files` 返回：

```json
{
  "vault_path": "<YOUR_VAULT_PATH>",
  "connected": true,
  "file_count": 1,
  "deleted_count": 0,
  "last_sync_at": "2026-10-14T00:00:00+00:00",
  "last_sync_status": "ok",
  "items": [],
  "total": 1,
  "offset": 0,
  "limit": 100
}
```

示例 items 省略具体 Source 内容。默认返回有效索引，`include_deleted=true` 包含删除记录。
支持 offset/limit 分页，limit 最大 200。目录可用不代表文件已索引，首次需要点击同步。

`POST /api/obsidian/sync` 无请求体，返回 scanned、added、updated、restored、deleted、unchanged、errors、completed_at 和 status。
status=partial 表示有读取错误，不会执行删除标记；Vault 无效返回 400，已有同步返回 409，数据库忙返回 503。

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/obsidian/sync -Method Post
Invoke-RestMethod http://127.0.0.1:8000/api/obsidian/files
```

## 伙伴上下文

用户档案 + 最多三条当前 Vault 的有效索引摘要，送入本地模拟模型。
当前使用英文词和中文二字片段匹配文件名、标签、摘要；最多检查最近 2000 个有效索引。
没有命中时，选近期笔记，并明确标注“未匹配关键词，仅供背景参考”。每条上下文摘要最多 800 字符。
文件删除并完成同步后，不再被引用；Vault 不可用时，不引用缓存笔记。
未同步的变更不会立即反映到回复中。

services/knowledge.py 中的 KnowledgeRetriever 协议预留向量检索接口。
笔记是待分析的数据，不能覆盖系统提示词；当前接口只支持 mock，未安装或调用外部模型。

## 自动验证

```powershell
cd <LIFE_OS_ROOT>\code\life-os\backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd ..\frontend
npm run build
```

测试使用临时 Vault 和临时 SQLite，覆盖只读、标签、递归扫描、增量更新、软删除/恢复、历史、读取失败、事务回滚、重复/并发同步、切换 Vault、伙伴引用与分页。
不会读写用户的真实 Vault。真实符号链接测试可能因 Windows 缺少创建权限跳过；过滤逻辑另有自动测试。

手动验证建议使用你自己创建的独立测试 Vault：新增 .md 后同步，修改后再同步，删除测试笔记后同步，并在 Knowledge 页面勾选“显示已删除的索引记录”。
Life OS 不替你执行这些源文件修改或删除操作。
