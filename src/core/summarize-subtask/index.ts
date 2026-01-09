import Anthropic from "@anthropic-ai/sdk"

import { t } from "../../i18n"
import { ApiHandler } from "../../api"
import { ApiMessage } from "../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"
import { getMessagesSinceLastSummary } from "../condense"

import { Task } from "../task/Task"

export const SUMMARY_PROMPT = `
Your task is to create a detailed summary of the conversation of the child task so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing development work without losing context.

Before providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:

1. Chronologically analyze each message and section of the conversation. For each section thoroughly identify:
   - The user's explicit requests and intents
   - Your approach to addressing the user's requests
   - Key decisions, technical concepts and code patterns
   - Specific details like:
     - file names
     - full code snippets
     - function signatures
     - file edits
  - Errors that you ran into and how you fixed them
  - Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.
2. Double-check for technical accuracy and completeness, addressing each required element thoroughly.
3. Ignore the the conversation of the parent task and only look at the child task.

Your summary should include the following sections (If the conversation contains relevant content):

1. Primary Request and Intent: Capture all of the user's explicit requests and intents in detail
2. Key Technical Concepts: List all important technical concepts, technologies, and frameworks discussed.
3. Files and Code Sections: Enumerate specific files and code sections examined, modified, or created. Pay special attention to the most recent messages and include full code snippets where applicable and include a summary of why this file read or edit is important.
4. Errors and fixes: List all errors that you ran into, and how you fixed them. Pay special attention to specific user feedback that you received, especially if the user told you to do something differently.
5. Problem Solving: Document problems solved and any ongoing troubleshooting efforts.
6. All user messages: List ALL user messages that are not tool results after created this subtask. These are critical for understanding the users' feedback and changing intent.
7. Current Work: Describe in detail precisely what was being worked on immediately before this summary request, paying special attention to the most recent messages from both user and assistant. Include file names and code snippets where applicable.
8. Optional Next Step: List the next step that you will take that is related to the most recent work you were doing. IMPORTANT: ensure that this step is DIRECTLY in line with the user's most recent explicit requests, and the task you were working on immediately before this summary request. If your last task was concluded, then only list next steps if they are explicitly in line with the users request. Do not start on tangential requests or really old requests that were already completed without confirming with the user first.
9. If there is a next step, include direct quotes from the most recent conversation showing exactly what task you were working on and where you left off. This should be verbatim to ensure there's no drift in task interpretation.

Here's an example of how your output should be structured:

<example>
<analysis>
[Your thought process, ensuring all points are covered thoroughly and accurately]
</analysis>

<summary>
[Your summary, may include (If the conversation contains relevant content):
	Primary Request and Intent, Key Technical Concepts, Files and Code Sections, Errors and fixes, Problem Solving, All user messages, Current Work]
</summary>
</example>

Please provide your summary based on the conversation so far, following this structure and ensuring precision and thoroughness in your response. 

NOTE: **Ignore the parent task and only look at the child task.**
NOTE: **If the conversation of child task does not involve the content in the template, it can be ignored (The corresponding block is not output directly in the summary).**
NOTE: **If the conversation of child task content is just simple chatting, or there is less valuable content, you can optionally ignore the above template (The corresponding block is not output directly in the summary), i.e., conduct a detailed summary for complex tasks, and a simple summary for simple tasks. The length of the summary should not be longer than the original conversation content.**
`

export type SubTaskSummaryResponse = {
	summary: string
	cost: number
	error?: string
}

const stripTrailingToolUse = (messages: ApiMessage[]): ApiMessage[] => {
	if (messages.length === 0) {
		return messages
	}

	const last = messages[messages.length - 1]
	if (last.role !== "assistant" || typeof last.content === "string") {
		return messages
	}

	const hasToolUse = last.content.some((block) => block.type === "tool_use")
	if (!hasToolUse) {
		return messages
	}

	return messages.slice(0, -1)
}

export async function summarizeSubTask(
	task: Task,
	messages: ApiMessage[],
	apiHandler: ApiHandler,
	condensingApiHandler?: ApiHandler,
): Promise<SubTaskSummaryResponse> {
	const response: SubTaskSummaryResponse = { summary: "", cost: 0 }
	const promptToUse = SUMMARY_PROMPT

	const safeMessages = stripTrailingToolUse(messages)
	const messagesToSummarize = getMessagesSinceLastSummary(safeMessages)

	const finalRequestMessage: Anthropic.MessageParam = {
		role: "user",
		content: "Summarize the conversation so far, as described in the prompt instructions.",
	}

	const requestMessages = maybeRemoveImageBlocks([...messagesToSummarize, finalRequestMessage], apiHandler).map(
		({ role, content }) => ({ role, content }),
	)

	let handlerToUse = condensingApiHandler || apiHandler

	if (!handlerToUse || typeof handlerToUse.createMessage !== "function") {
		handlerToUse = apiHandler

		if (!handlerToUse || typeof handlerToUse.createMessage !== "function") {
			const error = t("common:errors.condense_handler_invalid")
			return { ...response, error }
		}
	}

	const stream = handlerToUse.createMessage(promptToUse, requestMessages)

	let summary = ""
	let cost = 0

	// 开启等待动画任务
	let isStreamActive = true
	let dotCount = 0
	const waitingAnimation = async () => {
		while (isStreamActive) {
			dotCount = (dotCount % 3) + 1
			const dots = ".".repeat(dotCount)
			await task.say("subtask_result", dots, undefined, true)
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
			await task.say("subtask_result", `## Summary \n${summary}`, undefined, true)
		} else if (chunk.type === "usage") {
			cost = chunk.totalCost ?? 0
		}
	}

	summary = summary.trim()
	if (summary.length === 0) {
		const error = t("common:errors.condense_failed")
		return { ...response, cost, error }
	}

	return { summary, cost }
}
