import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import { ICodeParser, CodeBlock } from "../interfaces"
import { scannerExtensions } from "../shared/supported-extensions"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { sanitizeErrorMessage } from "../shared/validation-helpers"

/**
 * Minimal parser for Riddler indexing: treats the whole file as a single block.
 */
export class RiddlerCodeParser implements ICodeParser {
	async parseFile(
		filePath: string,
		options?: {
			content?: string
			fileHash?: string
		},
	): Promise<CodeBlock[]> {
		const ext = path.extname(filePath).toLowerCase()
		if (!scannerExtensions.includes(ext)) {
			return []
		}

		let content: string
		let fileHash: string

		if (options?.content) {
			content = options.content
			fileHash = options.fileHash || this.createFileHash(content)
		} else {
			try {
				content = await readFile(filePath, "utf8")
				fileHash = this.createFileHash(content)
			} catch (error) {
				console.error(`Error reading file ${filePath}:`, error)
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
					stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
					location: "parseFile",
				})
				return []
			}
		}

		return this.parseContent(filePath, content, fileHash)
	}

	private createFileHash(content: string): string {
		return createHash("sha256").update(content).digest("hex")
	}

	private async parseContent(filePath: string, content: string, fileHash: string): Promise<CodeBlock[]> {
		const startLine = 1
		const endLine = 1
		const contentPreview = content.slice(0, 100)
		const segmentHash = createHash("sha256")
			.update(`${filePath}-${startLine}-${endLine}-${content.length}-${contentPreview}`)
			.digest("hex")

		return [
			{
				file_path: filePath,
				identifier: null,
				type: "",
				start_line: startLine,
				end_line: endLine,
				content,
				segmentHash,
				fileHash,
			},
		]
	}
}

export const riddlerCodeParser = new RiddlerCodeParser()
