import Anthropic from "@anthropic-ai/sdk"

import { TelemetryService } from "@roo-code/telemetry"

import { t } from "../../i18n"
import { ApiHandler } from "../../api"
import { ApiMessage } from "../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"
import { getMessagesSinceLastSummary, SUMMARY_PROMPT } from "../condense"

import { Task } from "../task/Task"

export type SubTaskResponse = {
	messages: ApiMessage[] // The messages after summarization
	summary: string // The summary text; empty string for no summary
	cost: number // The cost of the summarization operation
	inputTokens?: number,
	outputTokens?: number,
	cacheWriteTokens?: number,
	cacheReadTokens?: number,
	newContextTokens?: number // The number of tokens in the context for the next API request
	error?: string // Populated iff the operation fails: error message shown to the user on failure (see Task.ts)
}

/**
 * Summarizes the conversation messages using an LLM call
 *
 * @param {ApiMessage[]} messages - The conversation messages
 * @param {ApiHandler} apiHandler - The API handler to use for token counting (fallback if condensingApiHandler not provided)
 * @param {string} systemPrompt - The system prompt for API requests (fallback if customCondensingPrompt not provided)
 * @param {string} taskId - The task ID for the conversation, used for telemetry
 * @param {number} prevContextTokens - The number of tokens currently in the context, used to ensure we don't grow the context
 * @param {boolean} isAutomaticTrigger - Whether the summarization is triggered automatically
 * @param {string} customCondensingPrompt - Optional custom prompt to use for condensing
 * @param {ApiHandler} condensingApiHandler - Optional specific API handler to use for condensing
 * @returns {SubTaskResponse} - The result of the summarization operation (see above)
 */
export async function summarizeSubTask(
	cline: Task,
	messages: ApiMessage[],
	apiHandler: ApiHandler,
	systemPrompt: string,
	taskId: string,
	prevContextTokens: number,
	isAutomaticTrigger?: boolean,
	customCondensingPrompt?: string,
	condensingApiHandler?: ApiHandler,
): Promise<SubTaskResponse> {
	TelemetryService.instance.captureContextCondensed(
		taskId,
		isAutomaticTrigger ?? false,
		!!customCondensingPrompt?.trim(),
		!!condensingApiHandler,
	)

	const response: SubTaskResponse = { messages, cost: 0, summary: "", inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }
	const messagesToSummarize = getMessagesSinceLastSummary(messages)

	const finalRequestMessage: Anthropic.MessageParam = {
		role: "user",
		content: "Summarize the conversation so far, as described in the prompt instructions.",
	}

	const requestMessages = maybeRemoveImageBlocks([...messagesToSummarize, finalRequestMessage], apiHandler).map(
		({ role, content }) => ({ role, content }),
	)

	// Note: this doesn't need to be a stream, consider using something like apiHandler.completePrompt
	// Use custom prompt if provided and non-empty, otherwise use the default SUMMARY_PROMPT
	const promptToUse = customCondensingPrompt?.trim() ? customCondensingPrompt.trim() : SUMMARY_PROMPT + "\nNOTE: As the summary of a subtask, you should preserve as much context as possible that is necessary for the parent task's completion."

	// Use condensing API handler if provided, otherwise use main API handler
	let handlerToUse = condensingApiHandler || apiHandler

	// Check if the chosen handler supports the required functionality
	if (!handlerToUse || typeof handlerToUse.createMessage !== "function") {
		console.warn(
			"Chosen API handler for condensing does not support message creation or is invalid, falling back to main apiHandler.",
		)

		handlerToUse = apiHandler // Fallback to the main, presumably valid, apiHandler

		// Ensure the main apiHandler itself is valid before this point or add another check.
		if (!handlerToUse || typeof handlerToUse.createMessage !== "function") {
			// This case should ideally not happen if main apiHandler is always valid.
			// Consider throwing an error or returning a specific error response.
			console.error("Main API handler is also invalid for condensing. Cannot proceed.")
			// Return an appropriate error structure for SubTaskResponse
			const error = t("common:errors.condense_handler_invalid")
			return { ...response, error }
		}
	}

	const stream = handlerToUse.createMessage(promptToUse, requestMessages)

	let summary = ""
	let cost = 0
	let outputTokens = 0
	let inputTokens = 0
	let cacheWriteTokens = 0
	let cacheReadTokens = 0

	// 开启等待动画任务
	let isStreamActive = true
	let dotCount = 0
	const waitingAnimation = async () => {
		while (isStreamActive) {
			dotCount = (dotCount % 3) + 1
			const dots = ".".repeat(dotCount)
			await cline.say("subtask_result", dots, undefined, true)
			await new Promise(resolve => setTimeout(resolve, 500)) // 每500ms更新一次
		}
	}
	
	// 启动等待动画
	const animationPromise = waitingAnimation()

	for await (const chunk of stream) {
		// 第一次收到数据时停止等待动画
		if (isStreamActive && (chunk.type === "text" || chunk.type === "usage")) {
			isStreamActive = false
			await animationPromise.catch(() => {}) // 等待动画任务结束，忽略任何错误
		}
		if (chunk.type === "text") {
			summary += chunk.text
			await cline.say("subtask_result", `## SummarizeSubTask \n${summary}`, undefined, true)
		} else if (chunk.type === "usage") {
			// Record final usage chunk only
			cost = chunk.totalCost ?? 0
			inputTokens = chunk.inputTokens ?? 0
			cacheWriteTokens = chunk.cacheWriteTokens ?? 0
			cacheReadTokens = chunk.cacheReadTokens ?? 0
			outputTokens = chunk.outputTokens ?? 0
		}
	}

	// 确保等待动画已停止
	isStreamActive = false

	summary = summary.trim()
	// await cline.say("subtask_result", `## SummarizeSubTask \n${summary}`)
	if (summary.length === 0) {
		const error = t("common:errors.condense_failed")
		return { ...response, cost, error }
	}

	const summaryMessage: ApiMessage = {
		role: "assistant",
		content: summary,
		ts: Date.now(),
		isSummary: true,
	}

	const newMessages = [summaryMessage]

	// Count the tokens in the context for the next API request
	// We only estimate the tokens in summaryMesage if outputTokens is 0, otherwise we use outputTokens
	const systemPromptMessage: ApiMessage = { role: "user", content: systemPrompt }

	const contextMessages = outputTokens
		? [systemPromptMessage]
		: [systemPromptMessage, summaryMessage]

	const contextBlocks = contextMessages.flatMap((message) =>
		typeof message.content === "string" ? [{ text: message.content, type: "text" as const }] : message.content,
	)

	const newContextTokens = outputTokens + (await apiHandler.countTokens(contextBlocks))
	// if (newContextTokens >= prevContextTokens) {
	// 	const error = t("common:errors.condense_context_grew")
	// 	return { ...response, cost, error }
	// }
	return { messages: newMessages, summary, cost, newContextTokens, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens }
}
