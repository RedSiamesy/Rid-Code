import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineAskUrlFetch } from "../../shared/ExtensionMessage"
import { ToolExecutionStatus } from "@roo-code/types"
import { geminiHandler } from "../../services/browser/UrlContentFetcher-riddler"

interface UrlFetchParams {
	url?: string
}

async function handlePartialRequest(
	cline: Task,
	params: UrlFetchParams,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const partialMessage = JSON.stringify({
		url: removeClosingTag("url", params.url),
	} satisfies ClineAskUrlFetch)

	await cline.ask("url_fetch", partialMessage, true).catch(() => {})
}

async function validateParams(
	cline: Task,
	params: UrlFetchParams,
	pushToolResult: PushToolResult,
): Promise<{ isValid: false } | { isValid: true; url: string }> {
	if (!params.url) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("url_fetch")
		pushToolResult(await cline.sayAndCreateMissingParamError("url_fetch", "url"))
		return { isValid: false }
	}

	return {
		isValid: true,
		url: params.url,
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
	url: string,
	executionId: string,
	pushToolResult: PushToolResult,
): Promise<void> {
	// Send started status
	await sendToolExecutionStatus(cline, {
		executionId,
		status: "started",
		toolName: "url_fetch",
	})

	try {
		// Construct URL fetch prompt
		const fetchPrompt = `你是一个专业的网页内容提取助手，负责从指定URL获取内容。

目标url: ${url}

提取要求：
- 完整提取网页的所有重要内容，包括文本、链接、结构化信息等

请执行以下任务：
1. 访问指定的网页URL
2. 提取网页的核心内容信息
3. 保持内容的原始结构和格式
4. 提取链接地址（以markdown链接形式展示）
5. 识别和提取关键信息点

输出要求：
- 使用markdown格式组织内容
- 保留网页中的链接（格式：[链接文本](URL)）
- 提供网页的基本信息（标题、来源等）
- 如果有表格或列表，请保持结构化格式
- 如果网页内容很长，请提供目录结构
- 除markdown形式的网页内容外，不要添加任何额外说明或评论

重要原则：
- 不要丢失网页信息，不要进行任何删减
- 尽可能完整地忠实地还原网页展示的原始内容
- 保持信息的准确性和完整性
- 如果网页无法访问，请说明具体原因
- 使用清晰的markdown格式便于阅读`

		// Use createMessage for streaming response
		const messages = [
			{
				role: "user" as const,
				content: url,
			},
		]

		let fullResponse = ""
		
		// Process streaming response
		const stream = geminiHandler.createMessage(fetchPrompt, messages)
		
		for await (const chunk of stream) {
			if (chunk.type === "text") {
				fullResponse += chunk.text
				
				// Send incremental output status update
				await sendToolExecutionStatus(cline, {
					executionId,
					status: "output",
					toolName: "url_fetch",
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
			toolName: "url_fetch",
			response: fullResponse,
		})
		
        await cline.say("mcp_server_response", fullResponse)
		pushToolResult(formatResponse.toolResult(fullResponse))

	} catch (error) {
		const errorMessage = String(error)
		
		console.error(`Failed to fetch URL content for ${url}:`, errorMessage)
		
		// Send error status
		await sendToolExecutionStatus(cline, {
			executionId,
			status: "error",
			toolName: "url_fetch",
			error: errorMessage,
		})
		
		await cline.say("error", `URL获取失败: ${errorMessage}`)
		pushToolResult(formatResponse.toolError(`URL fetch failed: ${errorMessage}`))
	}
}

export async function urlFetchTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		const params: UrlFetchParams = {
			url: block.params.url,
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

		const { url } = validation

		// Reset mistake count on successful validation
		cline.consecutiveMistakeCount = 0

		// Get user approval
		const completeMessage = JSON.stringify({
			url,
		} satisfies ClineAskUrlFetch)

		const executionId = cline.lastMessageTs?.toString() ?? Date.now().toString()
		const didApprove = await askApproval("url_fetch", completeMessage)

		if (!didApprove) {
			return
		}

		// Send mcp_server_request_started to trigger UI status change
		await cline.say("mcp_server_request_started")

		// Execute the tool and process results
		await executeToolAndProcessResult(cline, url, executionId, pushToolResult)
	} catch (error) {
		await handleError("executing URL fetch", error)
	}
}
