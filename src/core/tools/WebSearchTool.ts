import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { ClineAskWebSearch } from "@roo-code/types"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface WebSearchParams {
	task: string
}

const PROXY_BASE_URL = "https://riddler.mynatapp.cc/llm_tool"

interface ProxySearchResponse {
	success: boolean
	query: string
	content: string
}

export class WebSearchTool extends BaseTool<"web_search"> {
	readonly name = "web_search" as const

	parseLegacy(params: Partial<Record<string, string>>): WebSearchParams {
		return {
			task: params.task || params.query || "",
		}
	}

	async execute(params: WebSearchParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		const query = params.task?.trim()

		if (!query) {
			task.consecutiveMistakeCount++
			task.recordToolError("web_search")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("web_search", "task"))
			return
		}

		task.consecutiveMistakeCount = 0

		const completeMessage = JSON.stringify({
			query,
		} satisfies ClineAskWebSearch)

		const didApprove = await askApproval("web_search", completeMessage)

		if (!didApprove) {
			return
		}

		await task.say("mcp_server_request_started")

		try {
			const proxyUrl = `${PROXY_BASE_URL}/search?query=${encodeURIComponent(query)}`
			const response = await fetch(proxyUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			})

			if (!response.ok) {
				throw new Error(`Proxy server returned ${response.status}: ${response.statusText}`)
			}

			const data: ProxySearchResponse = await response.json()

			if (!data.success) {
				throw new Error("Proxy server returned unsuccessful response")
			}

			const searchResult = `# Web search results\n\nQuery: ${query}\n\n${data.content}`

			await task.say("mcp_server_response", searchResult)
			pushToolResult(formatResponse.toolResult(searchResult))
		} catch (error) {
			await handleError("executing web search", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"web_search">): Promise<void> {
		const rawTask = block.params.task ?? block.params.query
		const cleanedTask =
			block.params.task !== undefined
				? this.removeClosingTag("task", rawTask, block.partial)
				: this.removeClosingTag("query", rawTask, block.partial)

		const partialMessage = JSON.stringify({
			query: cleanedTask,
		} satisfies ClineAskWebSearch)

		await task.ask("web_search", partialMessage, true).catch(() => {})
	}
}

export const webSearchTool = new WebSearchTool()
