import path from "path"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { regexSearchFiles, OutputMode } from "../../services/ripgrep"

export async function globTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relDirPath: string | undefined = block.params.path || "."
	const pattern: string | undefined = block.params.pattern

	const absolutePath = relDirPath ? path.resolve(cline.cwd, relDirPath) : cline.cwd
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: ClineSayTool = {
		tool: "searchFiles", // 复用searchFiles的前端消息类型
		path: getReadablePath(cline.cwd, removeClosingTag("path", relDirPath)),
		regex: "(.*)", // 使用".*"作为regex来匹配所有文件，主要依靠glob pattern过滤
		filePattern: removeClosingTag("file_pattern", pattern),
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

			if (!pattern) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("grep")
				pushToolResult(await cline.sayAndCreateMissingParamError("grep", "file_pattern"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// 使用files_with_matches模式，并用".*"作为regex来匹配所有文件，主要依靠glob pattern过滤
			const results = await regexSearchFiles(
				cline.cwd,
				absolutePath,
				".*", // 匹配所有内容，让glob pattern来做文件过滤
				pattern, // 使用用户提供的glob pattern
				cline.rooIgnoreController,
				"files_with_matches" as OutputMode, // 只返回文件名，不返回内容
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
		await handleError("finding files with glob pattern", error)
		return
	}
}