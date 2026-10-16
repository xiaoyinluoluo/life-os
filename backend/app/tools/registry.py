from app.tools.base import Tool, ToolContext, ToolError
from app.tools.profile_tool import GetProfileTool
from app.tools.knowledge_search_tool import SearchKnowledgeTool
from app.tools.project_tool import CreateProjectTool
from app.tools.task_tool import CreateTaskTool
from app.tools.update_task_tool import UpdateTaskTool


class ToolRegistry:
    def __init__(self):
        self._tools = {}

    def register(self, tool: Tool):
        if tool.name in self._tools:
            raise ValueError('Duplicate tool name')
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool:
        if name not in self._tools:
            raise ToolError('工具不存在。', 404)
        return self._tools[name]

    def available_tools(self):
        return [tool.descriptor() for tool in self._tools.values()]

    def execute(self, name: str, arguments: dict, context: ToolContext):
        return self.get(name).execute(context, arguments)


registry = ToolRegistry()
for tool in (GetProfileTool(), SearchKnowledgeTool(), CreateProjectTool(), CreateTaskTool(), UpdateTaskTool()):
    registry.register(tool)
