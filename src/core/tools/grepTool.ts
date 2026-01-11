import path from "path"

import { Task } from "../task/Task"
import { ClineSayTool } from "@roo-code/types"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { regexSearchFiles, OutputMode } from "../../services/ripgrep"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface GrepParams {
	path: string
	regex: string
	file_pattern?: string | null
	output_mode?: OutputMode | null
	after_context?: number | null
	before_context?: number | null
	context?: number | null
	insensitive_case?: boolean | null
}

export class GrepTool extends BaseTool<"grep"> {
	readonly name = "grep" as const

	parseLegacy(params: Partial<Record<string, string>>): GrepParams {
		return {
			path: params.path || ".",
			regex: params.regex || "",
			file_pattern: params.file_pattern ?? undefined,
			output_mode: this.normalizeOutputMode(params.output_mode),
			after_context: this.parseNumber(params.after_context),
			before_context: this.parseNumber(params.before_context),
			context: this.parseNumber(params.context),
			insensitive_case: this.parseBoolean(params.insensitive_case),
		}
	}

	async execute(params: GrepParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks

		const relDirPath = params.path || "."
		const regex = params.regex
		const filePattern = params.file_pattern ?? undefined
		const afterContext = params.after_context ?? undefined
		const beforeContext = params.before_context ?? undefined
		const context = params.context ?? undefined
		const insensitiveCase = params.insensitive_case ?? undefined

		if (!relDirPath) {
			task.consecutiveMistakeCount++
			task.recordToolError("grep")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("grep", "path"))
			return
		}

		if (!regex) {
			task.consecutiveMistakeCount++
			task.recordToolError("grep")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("grep", "regex"))
			return
		}

		task.consecutiveMistakeCount = 0

		const absolutePath = path.resolve(task.cwd, relDirPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const outputMode = params.output_mode ?? "files_with_matches"
		const sharedMessageProps: ClineSayTool = {
			tool: "searchFiles",
			path: getReadablePath(task.cwd, relDirPath),
			regex: this.buildRegexDisplay(regex, {
				outputMode,
				afterContext,
				beforeContext,
				context,
				insensitiveCase,
			}),
			filePattern: filePattern,
			isOutsideWorkspace,
		}

		try {
			const results = await regexSearchFiles(
				task.cwd,
				absolutePath,
				regex,
				filePattern,
				task.rooIgnoreController,
				outputMode,
				afterContext,
				beforeContext,
				context,
				insensitiveCase,
			)

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: results } satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(results)
		} catch (error) {
			await handleError("grepping files", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"grep">): Promise<void> {
		const relDirPath = block.params.path || "."
		const regex = block.params.regex
		const filePattern = block.params.file_pattern
		const outputMode = block.params.output_mode
		const afterContext = block.params.after_context
		const beforeContext = block.params.before_context
		const context = block.params.context
		const insensitiveCase = block.params.insensitive_case

		const absolutePath = relDirPath ? path.resolve(task.cwd, relDirPath) : task.cwd
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

		const sharedMessageProps: ClineSayTool = {
			tool: "searchFiles",
			path: getReadablePath(task.cwd, this.removeClosingTag("path", relDirPath, block.partial)),
			regex: this.buildRegexDisplay(this.removeClosingTag("regex", regex, block.partial), {
				outputMode: this.removeClosingTag("output_mode", outputMode, block.partial),
				afterContext: this.removeClosingTag("after_context", afterContext, block.partial),
				beforeContext: this.removeClosingTag("before_context", beforeContext, block.partial),
				context: this.removeClosingTag("context", context, block.partial),
				insensitiveCase: this.removeClosingTag("insensitive_case", insensitiveCase, block.partial),
			}),
			filePattern: this.removeClosingTag("file_pattern", filePattern, block.partial),
			isOutsideWorkspace,
		}

		const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}

	private normalizeOutputMode(value?: string | null): OutputMode | undefined {
		if (value === "content" || value === "files_with_matches") {
			return value
		}
		return undefined
	}

	private parseNumber(value?: string): number | undefined {
		if (!value) {
			return undefined
		}

		const parsed = parseInt(value, 10)
		return Number.isNaN(parsed) ? undefined : parsed
	}

	private parseBoolean(value?: string): boolean | undefined {
		if (value === undefined) {
			return undefined
		}

		const normalized = value.trim().toLowerCase()
		if (normalized === "true") {
			return true
		}
		if (normalized === "false") {
			return false
		}

		return undefined
	}

	private buildRegexDisplay(
		regex: string,
		options: {
			outputMode?: OutputMode | string
			afterContext?: number | string
			beforeContext?: number | string
			context?: number | string
			insensitiveCase?: boolean | string
		},
	): string {
		const outputMode = this.normalizeOutputMode(options.outputMode)
		const afterContext = this.normalizeNumber(options.afterContext)
		const beforeContext = this.normalizeNumber(options.beforeContext)
		const context = this.normalizeNumber(options.context)
		const insensitiveCase = this.normalizeBoolean(options.insensitiveCase)

		const pieces: string[] = []
		if (insensitiveCase) {
			pieces.push("-i")
		}
		if (context !== undefined) {
			pieces.push(`-C ${context}`)
		} else {
			if (afterContext !== undefined) {
				pieces.push(`-A ${afterContext}`)
			}
			if (beforeContext !== undefined) {
				pieces.push(`-B ${beforeContext}`)
			}
		}
		if (outputMode === "content") {
			pieces.push("with content")
		}

		if (pieces.length === 0) {
			return regex
		}

		return `${regex}    ( ${pieces.join(" ")} )`
	}

	private normalizeNumber(value?: number | string): number | undefined {
		if (value === undefined || value === null) {
			return undefined
		}

		if (typeof value === "number") {
			return Number.isNaN(value) ? undefined : value
		}

		const parsed = parseInt(value, 10)
		return Number.isNaN(parsed) ? undefined : parsed
	}

	private normalizeBoolean(value?: boolean | string): boolean | undefined {
		if (value === undefined || value === null) {
			return undefined
		}

		if (typeof value === "boolean") {
			return value
		}

		const normalized = value.trim().toLowerCase()
		if (normalized === "true") {
			return true
		}
		if (normalized === "false") {
			return false
		}

		return undefined
	}
}

export const grepTool = new GrepTool()
