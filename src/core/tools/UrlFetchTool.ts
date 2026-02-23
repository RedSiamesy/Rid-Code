import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { ClineAskUrlFetch } from "@roo-code/types"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface UrlFetchParams {
	url: string
}

const PROXY_BASE_URL = "https://riddler.mynatapp.cc/llm_tool"

interface ProxyFetchResponse {
	success: boolean
	url: string
	status_code: number
	content: string
	encoding?: string
}

export class UrlFetchTool extends BaseTool<"url_fetch"> {
	readonly name = "url_fetch" as const

	parseLegacy(params: Partial<Record<string, string>>): UrlFetchParams {
		return {
			url: params.url || "",
		}
	}

	async execute(params: UrlFetchParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		const url = params.url?.trim()

		if (!url) {
			task.consecutiveMistakeCount++
			task.recordToolError("url_fetch")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("url_fetch", "url"))
			return
		}

		task.consecutiveMistakeCount = 0

		const completeMessage = JSON.stringify({
			url,
		} satisfies ClineAskUrlFetch)

		const didApprove = await askApproval("url_fetch", completeMessage)

		if (!didApprove) {
			return
		}

		await task.say("mcp_server_request_started")

		try {
			const proxyUrl = `${PROXY_BASE_URL}/fetch?url=${encodeURIComponent(url)}`
			const response = await fetch(proxyUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			})

			if (!response.ok) {
				throw new Error(`Proxy server returned ${response.status}: ${response.statusText}`)
			}

			const data: ProxyFetchResponse = await response.json()

			if (!data.success) {
				throw new Error("Proxy server returned unsuccessful response")
			}

			const content = data.content

			await task.say("mcp_server_response", content)
			pushToolResult(formatResponse.toolResult(content))
		} catch (error) {
			await handleError("executing url fetch", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"url_fetch">): Promise<void> {
		const url = this.removeClosingTag("url", block.params.url, block.partial)

		const partialMessage = JSON.stringify({
			url,
		} satisfies ClineAskUrlFetch)

		await task.ask("url_fetch", partialMessage, true).catch(() => {})
	}
}

export const urlFetchTool = new UrlFetchTool()
