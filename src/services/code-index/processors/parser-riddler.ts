import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import { Node } from "web-tree-sitter"
import { LanguageParser, loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import { parseMarkdown } from "../../tree-sitter/markdownParser"
import { ICodeParser, CodeBlock } from "../interfaces"
import { scannerExtensions, shouldUseFallbackChunking } from "../shared/supported-extensions"
import { MAX_BLOCK_CHARS, MIN_BLOCK_CHARS, MIN_CHUNK_REMAINDER_CHARS, MAX_CHARS_TOLERANCE_FACTOR } from "../constants"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { sanitizeErrorMessage } from "../shared/validation-helpers"

/**
 * Implementation of the code parser interface
 */
export class RiddlerCodeParser implements ICodeParser {
	private loadedParsers: LanguageParser = {}
	private pendingLoads: Map<string, Promise<LanguageParser>> = new Map()
	// Markdown files are now supported using the custom markdown parser
	// which extracts headers and sections for semantic indexing

	/**
	 * Parses a code file into code blocks
	 * @param filePath Path to the file to parse
	 * @param options Optional parsing options
	 * @returns Promise resolving to array of code blocks
	 */
	async parseFile(
		filePath: string,
		options?: {
			content?: string
			fileHash?: string
		},
	): Promise<CodeBlock[]> {
		// Get file extension
		const ext = path.extname(filePath).toLowerCase()

		// Skip if not a supported language
		if (!this.isSupportedLanguage(ext)) {
			return []
		}

		// Get file content
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

		// Parse the file
		return this.parseContent(filePath, content, fileHash)
	}

	/**
	 * Checks if a language is supported
	 * @param extension File extension
	 * @returns Boolean indicating if the language is supported
	 */
	private isSupportedLanguage(extension: string): boolean {
		return scannerExtensions.includes(extension)
	}

	/**
	 * Creates a hash for a file
	 * @param content File content
	 * @returns Hash string
	 */
	private createFileHash(content: string): string {
		return createHash("sha256").update(content).digest("hex")
	}

	/**
	 * Parses file content into code blocks
	 * @param filePath Path to the file
	 * @param content File content
	 * @param fileHash File hash
	 * @returns Array of code blocks
	 */
	private async parseContent(filePath: string, content: string, fileHash: string): Promise<CodeBlock[]> {
		const results: CodeBlock[] = []
		const identifier = null
		const type = ""
		const start_line = 1
		const end_line = 1
		const contentPreview = content.slice(0, 100)
		const segmentHash = createHash("sha256")
			.update(`${filePath}-${start_line}-${end_line}-${content.length}-${contentPreview}`)
			.digest("hex")

		results.push({
				file_path: filePath,
				identifier,
				type,
				start_line,
				end_line,
				content,
				segmentHash,
				fileHash,
			})

		return results
	}

}

// Export a singleton instance for convenience
export const riddlerCodeParser = new RiddlerCodeParser()
