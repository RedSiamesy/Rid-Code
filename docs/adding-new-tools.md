# 添加新工具开发指南

本文档详细说明了如何在 Roo Code 项目中添加新的 agent 工具。

## 目录

- [项目架构概述](#项目架构概述)
- [添加新工具的步骤](#添加新工具的步骤)
- [工具开发最佳实践](#工具开发最佳实践)
- [示例：创建文件复制工具](#示例创建文件复制工具)
- [测试工具](#测试工具)
- [常见问题](#常见问题)

## 项目架构概述

Roo Code 使用模块化的工具架构，每个工具都是独立的模块，通过统一的接口进行调用。主要组件包括：

- **工具路由器**：`src/core/assistant-message/presentAssistantMessage.ts`
- **工具定义**：`packages/types/src/tool.ts` 和 `src/shared/tools.ts`
- **工具实现**：`src/core/tools/` 目录下的各个工具文件
- **工具描述**：`src/core/prompts/### 6. 流式响应支持

- 处理 `block.partial` 情况
- 使用 `removeClosingTag` 清理部分标签

### 7. 执行状态管理

- 使用 `sendToolExecutionStatus` 函数报告工具执行状态
- 支持状态：`started`、`output`、`completed`、`error`
- 为长时间运行的操作提供实时反馈
- 使用 `executionId` 跟踪特定执行实例

### 8. 流式响应处理

对于需要处理流式API响应的工具，参考 webSearchTool 和 urlFetchTool 的实现：

```typescript
// 处理流式响应
const reader = response.body?.getReader()
if (!reader) {
    throw new Error('Failed to get response reader')
}

const decoder = new TextDecoder()
let fullContent = ''

try {
    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        fullContent += chunk
        
        // 发送实时状态更新
        if (fullContent.trim()) {
            await sendToolExecutionStatus(cline, {
                executionId,
                status: "output",
                toolName: "your_tool_name",
                response: fullContent,
            })
        }
    }
} finally {
    reader.releaseLock()
}
```s/` 目录下的描述文件

## 添加新工具的步骤

### 步骤 1：定义工具名称和类型

在 `packages/types/src/tool.ts` 文件中添加新工具名称：

```typescript
export const toolNames = [
    "execute_command",
    "read_file",
    "write_to_file",
    // ... 其他现有工具
    "your_new_tool", // 添加你的新工具名称
] as const
```

### 步骤 2：定义工具接口和参数

在 `src/shared/tools.ts` 文件中进行以下修改：

#### 2.1 添加参数名称

```typescript
export const toolParamNames = [
    "command",
    "path",
    "content",
    // ... 其他现有参数
    "your_param1",
    "your_param2",
    // 添加你的新工具所需的参数名称
] as const
```

#### 2.2 定义工具接口

```typescript
export interface YourNewToolUse extends ToolUse {
    name: "your_new_tool"
    params: Partial<Pick<Record<ToolParamName, string>, "your_param1" | "your_param2">>
}
```

#### 2.3 添加显示名称

```typescript
export const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
    execute_command: "run commands",
    read_file: "read files",
    // ... 其他工具
    your_new_tool: "your tool description",
} as const
```

#### 2.4 添加到工具组

```typescript
export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
    read: {
        tools: [
            "read_file",
            "fetch_instructions",
            // ... 其他读取类工具
        ],
    },
    edit: {
        tools: [
            "write_to_file",
            "apply_diff",
            // ... 其他编辑类工具
            "your_new_tool", // 根据工具功能选择合适的组
        ],
    },
    // ... 其他组
}
```

### 步骤 3：创建工具实现

在 `src/core/tools/` 目录下创建新文件 `yourNewTool.ts`：

```typescript
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { ToolExecutionStatus } from "@roo-code/types"

interface YourNewToolParams {
    param1?: string
    param2?: string
}

async function sendToolExecutionStatus(cline: Task, status: ToolExecutionStatus): Promise<void> {
    const clineProvider = await cline.providerRef.deref()
    clineProvider?.postMessageToWebview({
        type: "toolExecutionStatus",
        text: JSON.stringify(status),
    })
}

export async function yourNewTool(
    cline: Task,
    block: ToolUse,
    askApproval: AskApproval,
    handleError: HandleError,
    pushToolResult: PushToolResult,
    removeClosingTag: RemoveClosingTag,
) {
    try {
        const params: YourNewToolParams = {
            param1: block.params.your_param1,
            param2: block.params.your_param2,
        }

        // 处理部分请求（流式传输）
        if (block.partial) {
            const sharedMessageProps: ClineSayTool = {
                tool: "yourNewTool",
                toolName: "your_new_tool",
                toolDisplayName: "你的工具名称",
                parameters: [
                    { name: "param1", value: removeClosingTag("your_param1", params.param1) || "", label: "参数1标签" },
                    { name: "param2", value: removeClosingTag("your_param2", params.param2) || "", label: "参数2标签" },
                ],
            }
            const partialMessage = JSON.stringify(sharedMessageProps satisfies ClineSayTool)
            await cline.ask("tool", partialMessage, block.partial).catch(() => {})
            return
        }

        // 验证必需参数
        if (!params.param1) {
            cline.consecutiveMistakeCount++
            pushToolResult(await cline.sayAndCreateMissingParamError("your_new_tool", "your_param1"))
            return
        }

        cline.consecutiveMistakeCount = 0

        // 构建完整消息用于用户批准
        const sharedMessageProps: ClineSayTool = {
            tool: "yourNewTool",
            toolName: "your_new_tool",
            toolDisplayName: "你的工具名称",
            parameters: [
                { name: "param1", value: params.param1, label: "参数1标签" },
                { name: "param2", value: params.param2 || "", label: "参数2标签" },
            ],
        }
        const completeMessage = JSON.stringify(sharedMessageProps satisfies ClineSayTool)
        const didApprove = await askApproval("tool", completeMessage)

        if (!didApprove) {
            return
        }

        // 执行工具并处理结果
        const executionId = cline.lastMessageTs?.toString() ?? Date.now().toString()

        // 发送开始状态
        await sendToolExecutionStatus(cline, {
            executionId,
            status: "started",
            toolName: "your_new_tool",
        })

        try {
            // ========== 在这里实现你的工具功能 ==========
            
            // 示例：简单的同步操作
            const result = `Successfully executed your_new_tool with param1: ${params.param1}`
            
            // 示例：异步操作（如API调用）
            /*
            const response = await fetch('your-api-endpoint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    param1: params.param1,
                    param2: params.param2
                }),
                signal: AbortSignal.timeout(60000)
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const result = await response.text()
            */

            // 如需流式响应处理，参考webSearchTool的实现
            
            // 发送完成状态
            await sendToolExecutionStatus(cline, {
                executionId,
                status: "completed",
                toolName: "your_new_tool",
                response: result,
            })

            pushToolResult(formatResponse.toolResult(result))

        } catch (operationError) {
            const errorMessage = String(operationError)
            
            console.error(`Failed to execute your_new_tool:`, errorMessage)
            
            // 发送错误状态
            await sendToolExecutionStatus(cline, {
                executionId,
                status: "error",
                toolName: "your_new_tool",
                error: errorMessage,
            })
            
            await cline.say("error", `工具执行失败: ${errorMessage}`)
            pushToolResult(formatResponse.toolError(`Tool execution failed: ${errorMessage}`))
        }

    } catch (error) {
        await handleError("executing your new tool", error)
    }
}
```

### 步骤 4：添加工具描述

在 `src/core/prompts/tools/` 目录下创建 `your-new-tool.ts`：

```typescript
export function getYourNewToolDescription(): string {
    return `## your_new_tool
Description: Brief description of what your tool does. This description will be shown to the AI model to help it understand when and how to use your tool.

Parameters:
- your_param1: (required) Description of the first parameter - what it expects, format requirements, etc.
- your_param2: (optional) Description of the second parameter - when it's used, default behavior, etc.

Usage Notes:
- When to use this tool vs alternatives
- Any constraints or limitations
- Expected input/output formats
- Error conditions to be aware of

Examples:
<your_new_tool>
<your_param1>example value</your_param1>
<your_param2>optional value</your_param2>
</your_new_tool>`
}
```

### 步骤 5：注册工具描述

在 `src/core/prompts/tools/index.ts` 中添加导入和映射：

```typescript
// 在文件顶部添加导入
import { getYourNewToolDescription } from "./your-new-tool"

// 在 toolDescriptionMap 对象中添加映射
const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
    execute_command: (args) => getExecuteCommandDescription(args),
    read_file: (args) => getReadFileDescription(args),
    // ... 其他工具映射
    your_new_tool: () => getYourNewToolDescription(),
}
```

### 步骤 6：添加工具路由

在 `src/core/assistant-message/presentAssistantMessage.ts` 中进行以下修改：

#### 6.1 添加导入

```typescript
// 在文件顶部添加导入
import { yourNewTool } from "../tools/yourNewTool"
```

#### 6.2 添加工具描述

在 `toolDescription()` 函数的 switch 语句中添加：

```typescript
const toolDescription = (): string => {
    switch (block.name) {
        case "execute_command":
            return `[${block.name} for '${block.params.command}']`
        case "read_file":
            return getReadFileToolDescription(block.name, block.params)
        // ... 其他工具描述
        case "your_new_tool":
            return `[${block.name} for '${block.params.your_param1}']`
        // ... 其他情况
    }
}
```

#### 6.3 添加工具路由

在主 switch 语句中添加路由：

```typescript
switch (block.name) {
    case "write_to_file":
        await writeToFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
        break
    case "read_file":
        await readFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
        break
    // ... 其他工具路由
    case "your_new_tool":
        await yourNewTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
        break
    // ... 其他情况
}
```

## 工具开发最佳实践

### 1. 部分请求处理（Partial Request Handling）

**重要：所有工具都必须实现部分请求处理**，这是为了在 AI 构建工具参数时提供适当的用户界面反馈。

#### 1.1 添加到 ClineSayTool 接口

首先，在 `src/shared/ExtensionMessage.ts` 的 `ClineSayTool` 接口中添加你的工具类型：

```typescript
export interface ClineSayTool {
    tool:
        | "editedExistingFile"
        | "appliedDiff"
        | "newFileCreated"
        | "codebaseSearch"
        | "readFile"
        | "fetchInstructions"
        | "listFilesTopLevel"
        | "listFilesRecursive"
        | "listCodeDefinitionNames"
        | "searchFiles"
        | "webSearch"  // 示例：网络搜索工具
        | "urlFetch"   // 示例：URL抓取工具
        | "yourNewTool" // 添加你的新工具
        | "switchMode"
        | "newTask"
        | "finishTask"
        | "searchAndReplace"
        | "insertContent"
    // ... 其他属性
}
```

#### 1.2 实现部分请求处理模式

```typescript
export async function yourNewTool(
    cline: Task,
    block: ToolUse,
    askApproval: AskApproval,
    handleError: HandleError,
    pushToolResult: PushToolResult,
    removeClosingTag: RemoveClosingTag,
) {
    try {
        const params = {
            param1: block.params.your_param1,
            param2: block.params.your_param2,
        }

        // 处理部分请求 - 在工具构建阶段显示UI
        if (block.partial) {
            const sharedMessageProps: ClineSayTool = {
                tool: "yourNewTool",
                toolName: "your_new_tool",
                toolDisplayName: "你的工具显示名称",
                parameters: [
                    { name: "param1", value: removeClosingTag("your_param1", params.param1) || "", label: "参数1标签" },
                    { name: "param2", value: removeClosingTag("your_param2", params.param2) || "", label: "参数2标签" },
                ],
            }
            const partialMessage = JSON.stringify(sharedMessageProps satisfies ClineSayTool)
            await cline.ask("tool", partialMessage, block.partial).catch(() => {})
            return
        }

        // 验证必需参数
        if (!params.param1) {
            cline.consecutiveMistakeCount++
            pushToolResult(await cline.sayAndCreateMissingParamError("your_new_tool", "your_param1"))
            return
        }

        cline.consecutiveMistakeCount = 0

        // 构建完整消息用于用户批准
        const sharedMessageProps: ClineSayTool = {
            tool: "yourNewTool",
            toolName: "your_new_tool", 
            toolDisplayName: "你的工具显示名称",
            parameters: [
                { name: "param1", value: params.param1, label: "参数1标签" },
                { name: "param2", value: params.param2 || "", label: "参数2标签" },
            ],
        }
        const completeMessage = JSON.stringify(sharedMessageProps satisfies ClineSayTool)
        const didApprove = await askApproval("tool", completeMessage)
        
        if (!didApprove) {
            return
        }

        // 执行工具的主要逻辑...
        
    } catch (error) {
        await handleError("executing your new tool", error)
    }
}
```

#### 1.3 部分请求处理的重要要点

- **必须处理 `block.partial`**：当 AI 正在构建工具参数时，`block.partial` 为 `true`
- **使用标准化的 `ClineSayTool` 接口**：确保 UI 能够正确显示工具信息
- **使用 `parameters` 数组格式**：每个参数应该包含 name、value 和 label
- **在部分请求中使用 `removeClosingTag`**：处理未完成的XML标签
- **调用 `cline.ask` 而不是 `askApproval`**：部分请求时使用不同的方法
- **包含 `toolName` 和 `toolDisplayName`**：用于工具识别和UI显示

### 2. 错误处理

- 始终使用 `try-catch` 包装主要逻辑
- 使用 `consecutiveMistakeCount` 追踪错误
- 使用 `recordToolError` 记录工具错误
- 使用 `handleError` 处理未预期的错误

### 2. 用户交互

- 大多数工具都需要用户批准才能执行
- 使用 `askApproval` 函数请求用户批准
- 支持用户反馈和拒绝操作

### 3. 参数验证

- 验证所有必需参数
- 使用 `sayAndCreateMissingParamError` 处理缺失参数
- 提供清晰的错误消息

### 4. 流式传输支持

- 处理 `block.partial` 情况
- 使用 `removeClosingTag` 清理部分标签

### 5. 结果格式化

- 使用 `formatResponse.toolResult()` 格式化成功结果
- 使用 `formatResponse.toolError()` 格式化错误结果
- 支持文本和图像内容

### 6. 文件路径处理

- 使用 `path.resolve(cline.cwd, relativePath)` 处理相对路径
- 使用 `getReadablePath` 获取用户友好的路径显示
- 考虑工作区外文件的安全性

## 示例：创建文件复制工具

让我们创建一个完整的示例 - 文件复制工具：

### 1. 在 tool.ts 中添加工具名称

```typescript
export const toolNames = [
    // ... 现有工具
    "copy_file",
] as const
```

### 2. 在 tools.ts 中定义接口

```typescript
// 添加参数
export const toolParamNames = [
    // ... 现有参数
    "source_path",
    "destination_path",
] as const

// 定义接口
export interface CopyFileToolUse extends ToolUse {
    name: "copy_file"
    params: Partial<Pick<Record<ToolParamName, string>, "source_path" | "destination_path">>
}

// 添加显示名称
export const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
    // ... 其他工具
    copy_file: "copy files",
} as const

// 添加到编辑工具组
export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
    edit: {
        tools: [
            // ... 其他编辑工具
            "copy_file",
        ],
    },
}
```

### 3. 创建工具实现

`src/core/tools/copyFileTool.ts`：

```typescript
import path from "path"
import fs from "fs/promises"
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { fileExistsAtPath } from "../../utils/fs"

export async function copyFileTool(
    cline: Task,
    block: ToolUse,
    askApproval: AskApproval,
    handleError: HandleError,
    pushToolResult: PushToolResult,
    removeClosingTag: RemoveClosingTag,
) {
    const sourcePath: string | undefined = block.params.source_path
    const destinationPath: string | undefined = block.params.destination_path

    try {
        const params = {
            sourcePath: block.params.source_path,
            destinationPath: block.params.destination_path,
        }

        const sharedMessageProps: ClineSayTool = {
            tool: "copyFile",
            sourcePath: params.sourcePath,
            destinationPath: params.destinationPath,
        }

        if (block.partial) {
            const partialMessage = JSON.stringify({
                ...sharedMessageProps,
                content: ""
            } satisfies ClineSayTool)
            
            await cline.ask("tool", partialMessage, block.partial).catch(() => {})
            return
        }

        // 验证必需参数
        if (!params.sourcePath) {
            cline.consecutiveMistakeCount++
            pushToolResult(await cline.sayAndCreateMissingParamError("copy_file", "source_path"))
            return
        }

        if (!params.destinationPath) {
            cline.consecutiveMistakeCount++
            pushToolResult(await cline.sayAndCreateMissingParamError("copy_file", "destination_path"))
            return
        }

        cline.consecutiveMistakeCount = 0

        // 检查源文件是否存在
        const absoluteSourcePath = path.resolve(cline.cwd, params.sourcePath)
        const absoluteDestinationPath = path.resolve(cline.cwd, params.destinationPath)

        if (!(await fileExistsAtPath(absoluteSourcePath))) {
            const errorMessage = `Source file does not exist: ${params.sourcePath}`
            await cline.say("error", errorMessage)
            pushToolResult(formatResponse.toolError(errorMessage))
            return
        }

        // 请求用户批准
        const completeMessage = JSON.stringify({
            ...sharedMessageProps,
            sourcePath: getReadablePath(cline.cwd, params.sourcePath),
            destinationPath: getReadablePath(cline.cwd, params.destinationPath),
        } satisfies ClineSayTool)

        const didApprove = await askApproval("tool", completeMessage)
        if (!didApprove) {
            return
        }

        // 执行文件复制
        try {
            // 确保目标目录存在
            const destinationDir = path.dirname(absoluteDestinationPath)
            await fs.mkdir(destinationDir, { recursive: true })

            // 复制文件
            await fs.copyFile(absoluteSourcePath, absoluteDestinationPath)

            const result = `Successfully copied file from ${params.sourcePath} to ${params.destinationPath}`
            pushToolResult(formatResponse.toolResult(result))

        } catch (copyError) {
            const errorMessage = `Failed to copy file: ${copyError.message}`
            await cline.say("error", errorMessage)
            pushToolResult(formatResponse.toolError(errorMessage))
        }

    } catch (error) {
        await handleError("copying file", error)
    }
}
```

### 4. 添加工具描述

`src/core/prompts/tools/copy-file.ts`：

```typescript
export function getCopyFileDescription(): string {
    return `## copy_file
Description: Copy a file from one location to another within the workspace. This tool will create any necessary directories in the destination path.

Parameters:
- source_path: (required) The relative path to the source file to be copied
- destination_path: (required) The relative path where the file should be copied to

Usage Notes:
- Both paths should be relative to the current workspace
- The tool will create destination directories if they don't exist
- If destination file already exists, it will be overwritten
- Use this tool when you need to duplicate files or create backups

Examples:
<copy_file>
<source_path>src/original.js</source_path>
<destination_path>backup/original_backup.js</destination_path>
</copy_file>`
}
```

### 5. 注册描述和路由

按照前面步骤 5 和 6 的说明进行注册。

## 实际案例：网络搜索和URL抓取工具

### 添加到工具组

```typescript
export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
    read: {
        tools: [
            "read_file",
            "fetch_instructions",
            "list_files",
            "list_code_definition_names",
            "search_files",
            "codebase_search",
            "web_search",      // 网络搜索属于读取类工具
            "url_fetch",       // URL抓取也属于读取类工具
        ],
    },
    // ... 其他工具组
}
```

这个例子展示了如何将现有的功能从一个系统（MCP）重构到另一个系统（独立工具），同时保持功能完整性并改善用户体验。

## 测试工具

### 单元测试

在 `src/core/tools/__tests__/` 目录下创建测试文件：

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { yourNewTool } from "../yourNewTool"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"

describe("yourNewTool", () => {
    let mockTask: Partial<Task>
    let mockAskApproval: vi.MockedFunction<any>
    let mockHandleError: vi.MockedFunction<any>
    let mockPushToolResult: vi.MockedFunction<any>
    let mockRemoveClosingTag: vi.MockedFunction<any>

    beforeEach(() => {
        mockTask = {
            consecutiveMistakeCount: 0,
            recordToolError: vi.fn(),
            sayAndCreateMissingParamError: vi.fn(),
            ask: vi.fn(),
        }
        mockAskApproval = vi.fn()
        mockHandleError = vi.fn()
        mockPushToolResult = vi.fn()
        mockRemoveClosingTag = vi.fn((_, text) => text || "")
    })

    it("should handle missing required parameters", async () => {
        const block: ToolUse = {
            type: "tool_use",
            name: "your_new_tool",
            params: {},
            partial: false,
        }

        await yourNewTool(
            mockTask as Task,
            block,
            mockAskApproval,
            mockHandleError,
            mockPushToolResult,
            mockRemoveClosingTag,
        )

        expect(mockTask.consecutiveMistakeCount).toBe(1)
        expect(mockTask.recordToolError).toHaveBeenCalledWith("your_new_tool")
    })

    // 添加更多测试用例...
})
```

### 集成测试

你也可以在 `apps/vscode-e2e/src/suite/tools/` 目录下添加端到端测试。

## 常见问题

### Q: 我的工具没有出现在 AI 的提示中？

A: 检查以下几点：

1. 工具是否正确添加到 `toolNames` 数组
2. 工具描述是否正确注册在 `toolDescriptionMap`
3. 工具是否添加到了合适的 `TOOL_GROUPS`

### Q: 工具执行时出现路由错误？

A: 确保在 `presentAssistantMessage.ts` 中正确添加了：

1. 工具函数的 import
2. `toolDescription()` 中的 case
3. 主 switch 语句中的 case

### Q: 如何正确实现部分请求处理？

A: 确保以下几点：

1. 在 `ClineSayTool` 接口中添加了工具类型
2. 检查 `block.partial` 并使用 `cline.ask()` 而不是 `askApproval()`
3. 为部分请求设置 `content: ""`
4. 不要在 `sharedMessageProps` 中使用 `removeClosingTag`

### Q: 如何处理异步操作？

A: 所有工具函数都是 async 的，可以直接使用 await。对于长时间运行的操作，考虑添加进度反馈。

### Q: 如何访问文件系统？

A: 使用 Node.js 的 `fs/promises` 模块，总是使用 `path.resolve(cline.cwd, relativePath)` 将相对路径转换为绝对路径。

### Q: 如何添加配置选项？

A: 可以通过 VSCode 配置系统添加工具特定的设置，参考现有工具如何使用 `vscode.workspace.getConfiguration()`。

## 总结

添加新工具需要修改多个文件，但遵循现有的模式可以确保一致性和可维护性。记住要：

1. **保持代码风格一致**
2. **实现完整的部分请求处理** - 这是必须的，不是可选的
3. **使用标准化的 ClineSayTool 接口格式** - 包含 toolName、toolDisplayName 和 parameters 数组
4. **添加适当的错误处理和参数验证**
5. **在 ClineSayTool 接口中注册新工具类型**
6. **编写清晰的工具描述**
7. **实现执行状态管理** - 为用户提供实时反馈
8. **添加测试用例**
9. **考虑用户体验和安全性**
10. **支持流式响应处理**（如果适用）

### 重要变更 (2025年9月)

- **部分请求处理现在是强制要求**：所有新工具必须实现适当的 `block.partial` 处理
- **ClineSayTool 接口必须扩展**：新工具类型必须添加到接口中
- **标准化的 parameters 数组格式**：使用 `parameters: [{ name, value, label }]` 格式而不是直接参数赋值
- **工具执行状态管理**：集成 `sendToolExecutionStatus` 用于实时状态更新（started, output, completed, error）
- **增强的错误处理模式**：结合状态报告的完整错误处理
- **流式响应支持**：为需要长时间执行的工具提供实时反馈
- **网络工具重构**：从 MCP 内联实现迁移到独立工具的成功案例

这个架构的设计使得添加新工具相对简单，同时保持了代码的组织性和可扩展性。新的部分请求处理要求确保了用户在使用 AI agent 时能够获得及时和清晰的反馈。
