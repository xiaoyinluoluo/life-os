from pydantic import Field
from app.services.knowledge import retriever
from app.tools.base import Tool, ToolContext, ToolInput


class SearchInput(ToolInput):
    query: str = Field(min_length=1, max_length=4000)
    limit: int = Field(default=3, ge=1, le=5)


class SearchKnowledgeTool(Tool):
    name = 'search_knowledge'
    description = '按关键词检索当前授权 Vault 的有效索引摘要；不扫描或写入 Markdown。'
    input_model = SearchInput

    def _execute(self, context: ToolContext, arguments: SearchInput):
        return {'items': retriever.retrieve(context.session, arguments.query, arguments.limit)}
