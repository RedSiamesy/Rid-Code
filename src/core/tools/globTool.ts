import path from "path"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { regexSearchFiles } from "../../services/ripgrep"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface GlobParams {
	path: string
	pattern: string
}

export class GlobTool extends BaseTool<"glob"> {
	readonly name = "glob" as const

	parseLegacy(params: Partial<Record<string, string>>): GlobParams {
		return {
			path: params.path || ".",
			pattern: params.pattern || "",
		}
	}

	async execute(params: GlobParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		const relDirPath = params.path || "."
		const pattern = params.pattern

		if (!relDirPath) {
			task.consecutiveMistakeCount++
			task.recordToolError("glob")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("glob", "path"))
			return
		}

		if (!pattern) {
			task.consecutiveMistakeCount++
			task.recordToolError("glob")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("glob", "pattern"))
			return
		}

		task.consecutiveMistakeCount = 0

		const absolutePath = path.resolve(task.cwd, relDirPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: ClineSayTool = {
			tool: "searchFiles",
			path: getReadablePath(task.cwd, relDirPath),
			regex: ".*",
			filePattern: pattern,
			isOutsideWorkspace,
		}

		try {
			const results = await regexSearchFiles(
				task.cwd,
				absolutePath,
				".*",
				pattern,
				task.rooIgnoreController,
				"files_with_matches",
			)

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: results } satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(results)
		} catch (error) {
			await handleError("finding files with glob pattern", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"glob">): Promise<void> {
		const relDirPath = block.params.path || "."
		const pattern = block.params.pattern

		const absolutePath = relDirPath ? path.resolve(task.cwd, relDirPath) : task.cwd
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: ClineSayTool = {
			tool: "searchFiles",
			path: getReadablePath(task.cwd, this.removeClosingTag("path", relDirPath, block.partial)),
			regex: ".*",
			filePattern: this.removeClosingTag("pattern", pattern, block.partial),
			isOutsideWorkspace,
		}

		const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const globTool = new GlobTool()
