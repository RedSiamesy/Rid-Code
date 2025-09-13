import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineAskWebSearch } from "../../shared/ExtensionMessage"
import { ToolExecutionStatus } from "@roo-code/types"
// import { geminiHandler } from "../../services/browser/UrlContentFetcher-riddler"
import { GeminiHandler } from "../../api/providers/gemini"
// Create GeminiHandler with fixed configuration for URL content fetching
export const geminiHandler = new GeminiHandler({
	geminiApiKey: "AIzaSyDfCKt-bk2TUj9ZnXfBqIBsFyDDXRTb6d4", // TODO: 需要配置实际的API key
	apiModelId: "gemini-2.5-flash-lite",
	enableGrounding: true,
	enableUrlContext: true, // 启用URL上下文功能来获取网页内容
	modelTemperature: 0.0,
	modelMaxTokens: 32768,
	modelMaxThinkingTokens: 0, // 不需要思考模式
})

interface WebSearchParams {
	query?: string
}

async function handlePartialRequest(
	cline: Task,
	params: WebSearchParams,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const partialMessage = JSON.stringify({
		query: removeClosingTag("query", params.query),
	} satisfies ClineAskWebSearch)

	await cline.ask("web_search", partialMessage, true).catch(() => {})
}

async function validateParams(
	cline: Task,
	params: WebSearchParams,
	pushToolResult: PushToolResult,
): Promise<{ isValid: false } | { isValid: true; query: string }> {
	if (!params.query) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("web_search")
		pushToolResult(await cline.sayAndCreateMissingParamError("web_search", "query"))
		return { isValid: false }
	}

	return {
		isValid: true,
		query: params.query,
	}
}

async function sendToolExecutionStatus(cline: Task, status: ToolExecutionStatus): Promise<void> {
	const clineProvider = await cline.providerRef.deref()
	clineProvider?.postMessageToWebview({
		type: "toolExecutionStatus",
		text: JSON.stringify(status),
	})
}

async function executeToolAndProcessResult(
	cline: Task,
	query: string,
	executionId: string,
	pushToolResult: PushToolResult,
): Promise<void> {
	// Send started status
	await sendToolExecutionStatus(cline, {
		executionId,
		status: "started",
		toolName: "web_search",
	})

	try {


		// Construct search prompt
		const searchPrompt = `你是一个专业的信息搜索助手，负责根据用户查询进行深度的网络信息检索和分析。

用户将输入一段内容，你需要对内容进行网络搜索，检索相关信息，并生成markdown格式的回答。请确保搜索结果的准确性和时效性。

搜索要求：
- 详细程度：提供深度详细的分析，包括多维度的信息、背景知识、相关概念、最新发展和应用场景

请执行以下任务：
1. 进行全面的网络搜索以获取相关信息
2. 分析和整理搜索结果，确保信息的准确性和时效性
3. 提供结构化的回答，包括：
   - 核心信息摘要
   - 详细内容分析
   - 相关背景知识（如适用）
   - 重要链接和参考资料
   - 实际应用场景或建议（如适用）
   - 接口文档（如适用）

重要原则：
- 确保信息的准确性和可靠性
- 提供多个来源的信息验证
- 如果信息不确定，请明确标注
- 使用清晰的结构组织信息
- 包含相关的时间信息（如适用）
- 保留搜索内容来源url地址
`

		// Use createMessage for streaming response
		const messages = [
			{
				role: "user" as const,
				content: query,
			},
		]

		let fullResponse = ""
		
		// Process streaming response
		const stream = geminiHandler.createMessage(searchPrompt, messages)
		
		for await (const chunk of stream) {
			if (chunk.type === "text") {
				fullResponse += chunk.text
				
				// Send incremental output status update
				await sendToolExecutionStatus(cline, {
					executionId,
					status: "output",
					toolName: "web_search",
					response: fullResponse,
				})
			} else if (chunk.type === "reasoning") {
				// Handle reasoning content if needed
				console.log("Reasoning:", chunk.text)
			}
		}

		// Send completion status
		await sendToolExecutionStatus(cline, {
			executionId,
			status: "completed",
			toolName: "web_search",
			response: fullResponse,
		})
		
        await cline.say("mcp_server_response", fullResponse)
		pushToolResult(formatResponse.toolResult(fullResponse))

	} catch (error) {
		const errorMessage = String(error)
		
		console.error(`Failed to search for query "${query}":`, errorMessage)
		
		// Send error status
		await sendToolExecutionStatus(cline, {
			executionId,
			status: "error",
			toolName: "web_search",
			error: errorMessage,
		})
		
		await cline.say("error", `网页搜索失败: ${errorMessage}`)
		pushToolResult(formatResponse.toolError(`Web search failed: ${errorMessage}`))
	}
}

export async function webSearchTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		const params: WebSearchParams = {
			query: block.params.query,
		}

		// Handle partial requests
		if (block.partial) {
			await handlePartialRequest(cline, params, removeClosingTag)
			return
		}

		// Validate parameters
		const validation = await validateParams(cline, params, pushToolResult)
		if (!validation.isValid) {
			return
		}

		const { query } = validation

		// Reset mistake count on successful validation
		cline.consecutiveMistakeCount = 0

		// Get user approval
		const completeMessage = JSON.stringify({
			query,
		} satisfies ClineAskWebSearch)

		const executionId = cline.lastMessageTs?.toString() ?? Date.now().toString()
		const didApprove = await askApproval("web_search", completeMessage)

		if (!didApprove) {
			return
		}

		// Send mcp_server_request_started to trigger UI status change
		await cline.say("mcp_server_request_started")

		// Execute the tool and process results
		await executeToolAndProcessResult(cline, query, executionId, pushToolResult)
	} catch (error) {
		await handleError("executing web search", error)
	}
}
