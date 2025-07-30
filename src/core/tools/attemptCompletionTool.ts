import Anthropic from "@anthropic-ai/sdk"

import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"
import {
	ToolResponse,
	ToolUse,
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolDescription,
	AskFinishSubTaskApproval,
} from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

export async function attemptCompletionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
	toolDescription: ToolDescription,
	askFinishSubTaskApproval: AskFinishSubTaskApproval,
) {
	const result: string | undefined = block.params.result
	const command: string | undefined = block.params.command

	try {
		const lastMessage = cline.clineMessages.at(-1)

		if (block.partial) {
			if (command) {
				// the attempt_completion text is done, now we're getting command
				// remove the previous partial attempt_completion ask, replace with say, post state to webview, then stream command

				// const secondLastMessage = cline.clineMessages.at(-2)
				if (lastMessage && lastMessage.ask === "command") {
					// update command
					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				} else {
					// last message is completion_result
					// we have command string, which means we have the result as well, so finish it (doesnt have to exist yet)
					await cline.say("completion_result", removeClosingTag("result", result), undefined, false)

					TelemetryService.instance.captureTaskCompleted(cline.taskId)
					cline.emit("taskCompleted", cline.taskId, cline.getTokenUsage(), cline.toolUsage)

					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				}
			} else {
				// no command, still outputting partial result
				await cline.say("completion_result", removeClosingTag("result", result), undefined, block.partial)
			}
			return
		} else {
			if (!result) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("attempt_completion")
				pushToolResult(await cline.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Command execution is permanently disabled in attempt_completion
			// Users must use execute_command tool separately before attempt_completion
			await cline.say("completion_result", result, undefined, false)
			TelemetryService.instance.captureTaskCompleted(cline.taskId)
			cline.emit("taskCompleted", cline.taskId, cline.getTokenUsage(), cline.toolUsage)

			if (cline.parentTask) {
				const didApprove = await askFinishSubTaskApproval()

				if (!didApprove) {
					return
				}
				
				// const summary = await getFinishSubTaskSummary(cline, result)

				// tell the provider to remove the current subtask and resume the previous task in the stack
				await cline.providerRef.deref()?.finishSubTask(result)
				return
			}

			// We already sent completion_result says, an
			// empty string asks relinquishes control over
			// button and field.
			const { response, text, images } = await cline.ask("completion_result", "", false)

			// Signals to recursive loop to stop (for now
			// cline never happens since yesButtonClicked
			// will trigger a new task).
			if (response === "yesButtonClicked") {
				pushToolResult("")
				return
			}

			await cline.say("user_feedback", text ?? "", images)
			const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []

			toolResults.push({
				type: "text",
				text: `The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
			})

			toolResults.push(...formatResponse.imageBlocks(images))
			cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })
			cline.userMessageContent.push(...toolResults)

			return
		}
	} catch (error) {
		await handleError("inspecting site", error)
		return
	}
}



// import { ApiHandler, ApiHandlerCreateMessageMetadata, buildApiHandler } from "../../api"
// import { truncateConversationIfNeeded } from "../sliding-window"
// import { ApiMessage } from "../task-persistence/apiMessages"
// import {
// 	type ContextCondense,
// } from "@roo-code/types"


// async function getFinishSubTaskSummary(cline: Task, result:string) 
// : Promise<string>
// {
// 	const state = await cline.providerRef.deref()?.getState()

// 	const {
// 		autoCondenseContext = true,
// 		autoCondenseContextPercent = 100,
// 		profileThresholds = {},
// 	} = state ?? {}

// 	const systemPrompt = `You are "CodeCrafter," an expert AI Programming Assistant and a master of code, logic, and software architecture. Your primary directive is to be an exceptionally helpful and proactive partner to users, assisting them in all aspects of the software development lifecycle. Your ultimate goal is to empower users to write better code, solve problems faster, and learn new technologies effectively.

// **Core Responsibilities:**

// *   **Code Generation & Completion:** Write clean, efficient, and well-documented code in any requested programming language.
// *   **Explanation & Learning:** Explain complex code, algorithms, or programming concepts in a clear and easy-to-understand manner.
// *   **Debugging & Troubleshooting:** Analyze code snippets or error messages to identify the root cause of bugs and propose effective solutions.
// *   **Refactoring & Optimization:** Review existing code and suggest improvements for readability, performance, security, and maintainability.
// *   **Architectural Design:** Provide high-level architectural suggestions, design patterns, and best practices for building robust and scalable applications.
// *   **Testing:** Generate unit tests, suggest testing strategies, and help create a comprehensive test plan.

// **Key Capability: Tool Utilization**

// Beyond your extensive knowledge, you are equipped with a set of practical tools to interact with the user's development environment. You MUST use these tools when a task requires accessing or modifying local information.

// **Available Tools:**
// *   'file_reader': To read the content of one or more files.
// *   'file_writer': To write new content to a file or create a new file.
// *   'code_executor': To execute a piece of code and get its output, which is essential for verification and debugging.
// *   'web_search': To find the most up-to-date information, library documentation, or solutions to novel errors.
// ...

// **Rules for Tool Use:**
// 1.  **Analyze the Request:** First, determine if the user's request can be fulfilled with your internal knowledge or if it requires interacting with their files or system.
// 2.  **Select the Right Tool:** If external interaction is needed, choose the appropriate tool.
// *   *Example:* If a user says, "Fix the bug in my 'utils.py' file," your first step should be to use 'file_reader' to read 'utils.py'.
// 3.  **Think Step-by-Step:** Formulate a plan. For a debugging task, this might be: read the file, identify the potential error, suggest a fix, and offer to write the corrected code back using 'file_writer'.
// 4.  **Communicate Clearly:** Always inform the user which tool you are about to use and why. For example: "Okay, I will now use the 'file_reader' to examine the contents of 'utils.py' to understand the context of the bug."

// **Guiding Principles:**
// *   **Clarity First:** Prioritize clear, simple, and direct communication. Avoid jargon where possible.
// *   **Best Practices:** Always adhere to industry best practices regarding coding standards, security, and project structure.
// *   **Proactivity:** Don't just answer the question. If you see a potential improvement, a security vulnerability, or a better way to do something, proactively suggest it.
// *   **Context-Awareness:** Maintain the context of the conversation to provide relevant and coherent support over multiple interactions.`
// 	const customCondensingPrompt = state?.customCondensingPrompt
// 	const condensingApiConfigId = state?.condensingApiConfigId
// 	const listApiConfigMeta = state?.listApiConfigMeta

// 	let condensingApiHandler: ApiHandler | undefined
// 			if (condensingApiConfigId && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
// 				// Using type assertion for the id property to avoid implicit any
// 				const matchingConfig = listApiConfigMeta.find((config: any) => config.id === condensingApiConfigId)
// 				if (matchingConfig) {
// 					const profile = await cline.providerRef.deref()?.providerSettingsManager.getProfile({
// 						id: condensingApiConfigId,
// 					})
// 					// Ensure profile and apiProvider exist before trying to build handler
// 					if (profile && profile.apiProvider) {
// 						condensingApiHandler = buildApiHandler(profile)
// 					}
// 				}
// 			}
	

// 	const DEFAULT_THINKING_MODEL_MAX_TOKENS = 16_384
// 	const modelInfo = cline.api.getModel().info
// 	const { contextTokens } = cline.getTokenUsage()
// 	const maxTokens = modelInfo.supportsReasoningBudget
// 		? cline.apiConfiguration.modelMaxTokens || DEFAULT_THINKING_MODEL_MAX_TOKENS
// 		: modelInfo.maxTokens || DEFAULT_THINKING_MODEL_MAX_TOKENS

// 	const contextWindow = modelInfo.contextWindow

// 	const currentProfileId =
// 		state?.listApiConfigMeta.find((profile) => profile.name === state?.currentApiConfigName)?.id ??
// 		"default"

// 	if (contextTokens > 0.2 * maxTokens) {
// 		const truncateResult = await truncateConversationIfNeeded({
// 			messages: cline.apiConversationHistory,
// 			totalTokens: contextTokens,
// 			maxTokens,
// 			contextWindow,
// 			apiHandler: cline.api,
// 			autoCondenseContext,
// 			autoCondenseContextPercent,
// 			systemPrompt,
// 			taskId: cline.taskId,
// 			customCondensingPrompt,
// 			condensingApiHandler,
// 			profileThresholds,
// 			currentProfileId,
// 		})

// 		// ApiMessage[]
// 		// const { summary, cost, prevContextTokens, newContextTokens = 0 } = truncateResult
// 		// const contextCondense: ContextCondense = { summary, cost, newContextTokens, prevContextTokens }
// 		// await cline.say(
// 		// 	"condense_context",
// 		// 	undefined /* text */,
// 		// 	undefined /* images */,
// 		// 	false /* partial */,
// 		// 	undefined /* checkpoint */,
// 		// 	undefined /* progressStatus */,
// 		// 	{ isNonInteractive: true } /* options */,
// 		// 	contextCondense,
// 		// )

// 		if (truncateResult.error) {
// 			return truncateResult.summary
// 		} 
// 		return JSON.stringify(cline.apiConversationHistory)
		
// 	} else {
// 		// 直接返回所有对话序列化组成的字符串
// 		return JSON.stringify(cline.apiConversationHistory)
// 	}
// }