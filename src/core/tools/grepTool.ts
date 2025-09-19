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

	const absolutePath = relDirPath ? path.resolve(cline.cwd, relDirPath) : cline.cwd
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: ClineSayTool = {
		tool: "searchFiles",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relDirPath)),
		regex: removeClosingTag("regex", regex),
		filePattern: removeClosingTag("file_pattern", filePattern),
		isOutsideWorkspace,
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
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
			let validatedOutputMode: OutputMode = "content" // default
			if (outputMode) {
				const cleanedMode = removeClosingTag("output_mode", outputMode)
				if (cleanedMode === "content" || cleanedMode === "files_with_matches") {
					validatedOutputMode = cleanedMode as OutputMode
				}
			}

			const results = await regexSearchFiles(
				cline.cwd,
				absolutePath,
				regex,
				filePattern,
				cline.rooIgnoreController,
				validatedOutputMode,
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
