import path from "path"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { regexSearchFiles, OutputMode } from "../../services/ripgrep"

export async function grepTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relDirPath: string | undefined = block.params.path || "."
	const regex: string | undefined = block.params.regex
	const filePattern: string | undefined = block.params.file_pattern
	const outputMode: string | undefined = block.params.output_mode
	const afterContext: string | undefined = block.params.after_context
	const beforeContext: string | undefined = block.params.before_context
	const context: string | undefined = block.params.context
	const insensitiveCase: string | undefined = block.params.insensitive_case

	const absolutePath = relDirPath ? path.resolve(cline.cwd, relDirPath) : cline.cwd
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: ClineSayTool = {
		tool: "searchFiles",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relDirPath)),
		regex: removeClosingTag("regex", regex) + (afterContext || beforeContext || context || outputMode === "content" || insensitiveCase === "true" ? `    ( ${insensitiveCase === "true" ? "-i " : ""}${afterContext ? "-A " + afterContext + " " : ""}${beforeContext ? "-B " + beforeContext + " " : ""}${context ? "-C " + context + " " : ""}${outputMode === "content" ? "with content " : ""})` : ""),
		filePattern: removeClosingTag("file_pattern", filePattern),
		isOutsideWorkspace,
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!cline.clineMessages || cline.clineMessages.length === 0 
				|| cline.clineMessages[cline.clineMessages.length - 1].type !== "ask"
				|| cline.clineMessages[cline.clineMessages.length - 1].ask !== "tool"
			){
				const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
				await cline.ask("tool", partialMessage, true).catch(() => {})
			}

			if (!relDirPath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("grep")
				pushToolResult(await cline.sayAndCreateMissingParamError("grep", "path"))
				return
			}

			if (!regex) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("grep")
				pushToolResult(await cline.sayAndCreateMissingParamError("grep", "regex"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Validate and set output mode
			let validatedOutputMode: OutputMode = "files_with_matches" // default
			if (outputMode) {
				const cleanedMode = removeClosingTag("output_mode", outputMode)
				if (cleanedMode === "content" || cleanedMode === "files_with_matches") {
					validatedOutputMode = cleanedMode as OutputMode
				}
			}

			// Validate and set context parameters
			let validatedAfterContext: number | undefined
			let validatedBeforeContext: number | undefined
			let validatedContext: number | undefined
			let validatedInsensitiveCase: boolean = false

			if (context) {
				const cleanedContext = removeClosingTag("context", context)
				const contextNum = parseInt(cleanedContext, 10)
				if (!isNaN(contextNum) && contextNum >= 0) {
					validatedContext = contextNum
				}
			} else {
				if (afterContext) {
					const cleanedAfterContext = removeClosingTag("after_context", afterContext)
					const afterContextNum = parseInt(cleanedAfterContext, 10)
					if (!isNaN(afterContextNum) && afterContextNum >= 0) {
						validatedAfterContext = afterContextNum
					}
				}

				if (beforeContext) {
					const cleanedBeforeContext = removeClosingTag("before_context", beforeContext)
					const beforeContextNum = parseInt(cleanedBeforeContext, 10)
					if (!isNaN(beforeContextNum) && beforeContextNum >= 0) {
						validatedBeforeContext = beforeContextNum
					}
				}

				if (insensitiveCase) {
					const cleanedInsensitiveCase = removeClosingTag("insensitive_case", insensitiveCase)
					validatedInsensitiveCase = cleanedInsensitiveCase?.toLowerCase() === "true"
				}
			}

			const results = await regexSearchFiles(
				cline.cwd,
				absolutePath,
				regex,
				filePattern,
				cline.rooIgnoreController,
				validatedOutputMode,
				validatedAfterContext,
				validatedBeforeContext,
				validatedContext,
				validatedInsensitiveCase,
			)

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: results } satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(results)

			return
		}
	} catch (error) {
		await handleError("grepping files", error)
		return
	}
}
