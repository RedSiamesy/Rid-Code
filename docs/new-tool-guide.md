# 添加新 Agent 工具的权威指南 (代码分析版)

本指南基于对当前项目代码的直接分析，提供了添加新 Agent 工具的准确步骤。

假设我们要创建一个名为 `file_info` 的新工具，它用来获取文件的基本信息（例如大小和创建日期）。

---

### 步骤 1: 声明工具名称

*   **文件**: `packages/types/src/tool.ts`
*   **操作**: 在 `toolNames` 数组中添加 `"file_info"`。

```typescript
// packages/types/src/tool.ts

export const toolNames = [
    "execute_command",
    "read_file",
    "write_to_file",
    // ... 其他现有工具
    "file_info", // <--- 添加这一行
] as const;
```

---

### 步骤 2: 定义工具接口和元数据

*   **文件**: `src/shared/tools.ts`
*   **操作**: 添加参数名、接口定义和显示名称。

```typescript
// src/shared/tools.ts

// 1. 添加参数名 (如果需要)
export const toolParamNames = [
    "command",
    "path", // 我们的新工具将复用 'path' 参数
    // ...
] as const;

// 2. 定义新工具的接口
export interface FileInfoToolUse extends ToolUse {
    name: "file_info";
    params: Partial<Pick<Record<ToolParamName, string>, "path">>;
}

// 3. 添加显示名称
export const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
    // ...
    file_info: "get file info", // <--- 添加这一行
} as const;

// 4. 添加到工具组
export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
    read: {
        tools: [
            "read_file",
            // ...
            "file_info", // <--- 添加到 'read' 组
        ],
    },
    // ...
};
```

---

### 步骤 3: 关联工具与模式 (Mode)

*   **文件**: `src/shared/modes.ts`
*   **操作**: 允许 `editor` 模式使用此工具。

```typescript
// src/shared/modes.ts

export const MODES: Record<Mode, ModeConfig> = {
    // ...
    editor: {
        name: "Editor",
        // ...
        allowedTools: [
            "read_file",
            "write_to_file",
            // ...
            "file_info", // <--- 添加这一行
        ],
    },
    // ...
};
```

---

### 步骤 4: 实现工具的核心逻辑

*   **新文件**: `src/core/tools/fileInfoTool.ts`
*   **操作**: 创建这个新文件并添加以下模板代码。

```typescript
// src/core/tools/fileInfoTool.ts

import path from "path";
import fs from "fs/promises";
import { Task } from "../task/Task";
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools";
import { formatResponse } from "../prompts/responses";
import { ClineSayTool } from "../../shared/ExtensionMessage";
import { getReadablePath } from "../../utils/path";

// 定义工具接收的参数
interface FileInfoParams {
    path?: string;
}

export async function fileInfoTool(
    cline: Task,
    block: ToolUse,
    askApproval: AskApproval,
    handleError: HandleError,
    pushToolResult: PushToolResult,
    removeClosingTag: RemoveClosingTag,
) {
    try {
        const params: FileInfoParams = {
            path: block.params.path,
        };

        // 1. 处理部分请求 (用于UI实时反馈)
        if (block.partial) {
            const partialMessage = JSON.stringify({
                tool: "fileInfo", // 驼峰式命名，用于UI
                toolName: "file_info",
                toolDisplayName: "Get File Info",
                parameters: [
                    { name: "path", value: removeClosingTag("path", params.path) || "", label: "File Path" },
                ],
            } satisfies ClineSayTool);
            await cline.ask("tool", partialMessage, block.partial).catch(() => {});
            return;
        }

        // 2. 验证必需参数
        if (!params.path) {
            cline.consecutiveMistakeCount++;
            pushToolResult(await cline.sayAndCreateMissingParamError("file_info", "path"));
            return;
        }
        cline.consecutiveMistakeCount = 0;

        const readablePath = getReadablePath(cline.cwd, params.path);

        // 3. 请求用户批准
        const completeMessage = JSON.stringify({
            tool: "fileInfo",
            toolName: "file_info",
            toolDisplayName: "Get File Info",
            parameters: [{ name: "path", value: readablePath, label: "File Path" }],
        } satisfies ClineSayTool);

        if (!(await askApproval("tool", completeMessage))) {
            return; // 用户拒绝
        }

        // 4. 执行核心功能
        const absolutePath = path.resolve(cline.cwd, params.path);
        const stats = await fs.stat(absolutePath);
        const result = `
<file_info>
  <path>${readablePath}</path>
  <size_bytes>${stats.size}</size_bytes>
  <created_at>${stats.birthtime.toISOString()}</created_at>
  <modified_at>${stats.mtime.toISOString()}</modified_at>
</file_info>
`;
        // 5. 返回结果
        pushToolResult(formatResponse.toolResult(result));

    } catch (error) {
        await handleError("getting file info", error);
    }
}
```

---

### 步骤 5: 为 AI 提供工具描述

*   **新文件**: `src/core/prompts/tools/file-info.ts`
*   **操作**: 创建这个新文件并添加描述。

```typescript
// src/core/prompts/tools/file-info.ts

export function getFileInfoDescription(): string {
    return `## file_info
Description: Gets basic information about a file, such as its size and creation/modification dates.

Parameters:
- path: (required) The relative path to the file.

Example:
<file_info>
<path>src/index.js</path>
</file_info>`;
}
```

---

### 步骤 6: 注册工具并设置路由

*   **文件 1**: `src/core/prompts/tools/index.ts`

```typescript
// src/core/prompts/tools/index.ts

// 1. 添加导入
import { getFileInfoDescription } from "./file-info";
// ...

// 2. 添加到映射
const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
    // ...
    file_info: () => getFileInfoDescription(), // <--- 添加这一行
};
```

*   **文件 2**: `src/core/assistant-message/presentAssistantMessage.ts`

```typescript
// src/core/assistant-message/presentAssistantMessage.ts

// 1. 添加导入
import { fileInfoTool } from "../tools/fileInfoTool";
// ...

// 2. 在文件底部的 switch 语句中添加 case
switch (block.name) {
    // ...
    case "file_info":
        await fileInfoTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag);
        break;
    // ...
}
```

---

### 步骤 7: 更新 UI 类型定义

*   **文件**: `src/shared/ExtensionMessage.ts`
*   **操作**: 在 `ClineSayTool` 接口中添加新工具的类型。

```typescript
// src/shared/ExtensionMessage.ts

export interface ClineSayTool {
    tool:
        | "readFile"
        | "writeFile"
        // ...
        | "fileInfo"; // <--- 添加这一行 (注意是驼峰式)
    // ...
}
```
