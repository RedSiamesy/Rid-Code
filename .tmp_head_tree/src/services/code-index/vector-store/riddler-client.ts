import { createHash } from "crypto"
import * as path from "path"
import { readLines } from "../../../integrations/misc/read-lines"
import { IVectorStore, VectorStoreSearchResult } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"
import * as vscode from "vscode"

/**
 * Riddler implementation of the vector store interface.
 */
export class RiddlerVectorStore implements IVectorStore {
	private readonly vectorSize: number
	private readonly collectionName: string
	private riddlerUrl: string = "http://localhost:8000"
	private readonly apiKey?: string
	private readonly workspacePath: string

	constructor(workspacePath: string, url: string | undefined, vectorSize: number, apiKey?: string) {
		this.riddlerUrl = this.parseRiddlerUrl(url)
		this.apiKey = apiKey
		this.vectorSize = vectorSize
		this.workspacePath = workspacePath

		const hash = createHash("sha256").update(`${vscode.env.machineId}@${workspacePath}`).digest("hex")
		this.collectionName = `ws-${hash.substring(0, 16)}`
	}

	private parseRiddlerUrl(url: string | undefined): string {
		if (!url || url.trim() === "") {
			return "http://localhost:8000"
		}

		const trimmedUrl = url.trim()
		if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://") && !trimmedUrl.includes("://")) {
			return this.parseHostname(trimmedUrl)
		}

		try {
			new URL(trimmedUrl)
			return trimmedUrl
		} catch {
			return this.parseHostname(trimmedUrl)
		}
	}

	private parseHostname(hostname: string): string {
		if (hostname.includes(":")) {
			return hostname.startsWith("http") ? hostname : `http://${hostname}`
		}
		return `http://${hostname}`
	}

	private async makeRequest(endpoint: string, method: string = "GET", body?: unknown): Promise<any> {
		const url = `${this.riddlerUrl}${endpoint}`
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"User-Agent": "Roo-Code",
		}

		if (this.apiKey) {
			headers["Authorization"] = `Bearer ${this.apiKey}`
		}

		const config: RequestInit = {
			method,
			headers,
		}

		if (body && method !== "GET") {
			config.body = JSON.stringify(body)
		}

		const response = await fetch(url, config)
		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`HTTP ${response.status}: ${errorText}`)
		}

		const contentType = response.headers.get("content-type")
		if (contentType && contentType.includes("application/json")) {
			return await response.json()
		}
		return await response.text()
	}

	async initialize(): Promise<boolean> {
		try {
			const response = await this.makeRequest(`/files/${this.collectionName}`)
			if (response && response.status === "success" && Array.isArray(response.files)) {
				return false
			}
			return true
		} catch (error: any) {
			const errorMessage = error?.message || String(error)
			throw new Error(
				`Failed to connect to Codebase-Service. Ensure it is running and reachable at ${this.riddlerUrl}. Error: ${errorMessage}`,
			)
		}
	}

	async upsertPoints(
		points: Array<{ id: string; vector: number[]; payload: Record<string, any> }>,
	): Promise<void> {
		const fileGroups = new Map<string, Array<{ id: string; vector: number[]; payload: Record<string, any> }>>()
		for (const point of points) {
			const filePath = point.payload?.filePath
			if (!filePath) {
				continue
			}
			if (!fileGroups.has(filePath)) {
				fileGroups.set(filePath, [])
			}
			fileGroups.get(filePath)!.push(point)
		}

		for (const [filePath, filePoints] of fileGroups) {
			const sortedPoints = filePoints.sort(
				(a, b) => (a.payload.startLine || 0) - (b.payload.startLine || 0),
			)
			const content = sortedPoints.map((point) => point.payload.codeChunk || "").join("\n")
			await this.makeRequest("/add_file", "POST", {
				collection_name: this.collectionName,
				file_path: filePath,
				content,
				need_enhancement: true,
			})
		}
	}

	async search(
		_queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
		query?: string,
	): Promise<VectorStoreSearchResult[]> {
		if (!query) {
			return []
		}

		let paths: string[] = []
		if (directoryPrefix) {
			const normalizedPrefix = path.posix.normalize(directoryPrefix.replace(/\\/g, "/"))
			if (normalizedPrefix !== "." && normalizedPrefix !== "./") {
				paths = [directoryPrefix]
			}
		}

		const searchRequest = {
			collection_name: this.collectionName,
			queries: [query],
			n_results: maxResults ?? DEFAULT_MAX_SEARCH_RESULTS,
			padding: 3,
			threshold: minScore ?? DEFAULT_SEARCH_MIN_SCORE,
			rerank_enable: false,
			paths,
		}

		const response = await this.makeRequest("/search", "POST", searchRequest)
		const results: VectorStoreSearchResult[] = []

		if (response?.data) {
			for (const result of response.data) {
				const filePath = path.resolve(this.workspacePath, result.file_path)
				const score = result.score
				const lines = result.lines
				if (!lines || lines.length === 0) {
					continue
				}

				try {
					const startLine = Math.min(...lines)
					const endLine = Math.max(...lines)
					const sortedLines = [...lines].sort((a: number, b: number) => a - b)
					const rawContent = await readLines(filePath, endLine - 1, startLine - 1)
					const allLines = rawContent.split("\n")
					const codeChunkLines: string[] = []
					let prevLineNumber = -1

					for (const lineNumber of sortedLines) {
						if (prevLineNumber !== -1 && lineNumber > prevLineNumber + 1) {
							codeChunkLines.push("...")
						}

						const lineIndex = lineNumber - startLine
						if (lineIndex >= 0 && lineIndex < allLines.length) {
							const lineNumberWidth = String(endLine).length
							const formattedLineNumber = String(lineNumber).padStart(lineNumberWidth, " ")
							codeChunkLines.push(`${formattedLineNumber} | ${allLines[lineIndex]}`)
						}
						prevLineNumber = lineNumber
					}

					results.push({
						id: `${filePath}:${startLine}:${endLine}`,
						score: score || 0,
						payload: {
							filePath,
							codeChunk: `${codeChunkLines.join("\n")}\n`,
							startLine,
							endLine,
						},
					})
				} catch (fileError) {
					console.warn(`[RiddlerVectorStore] Failed to read file ${filePath}:`, fileError)
				}
			}
		}

		return results
	}

	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) {
			return
		}

		const relativeFilePaths = filePaths.map((filePath) => {
			const relativePath = path.isAbsolute(filePath) ? path.relative(this.workspacePath, filePath) : filePath
			return path.normalize(relativePath)
		})

		await this.makeRequest("/delete_files", "POST", {
			collection_name: this.collectionName,
			file_paths: relativeFilePaths,
		})
	}

	async deleteCollection(): Promise<void> {
		await this.makeRequest(`/delete/${this.collectionName}`, "POST")
	}

	async clearCollection(): Promise<void> {
		await this.deleteCollection()
	}

	async collectionExists(): Promise<boolean> {
		const response = await this.makeRequest(`/files/${this.collectionName}`)
		return response && response.status === "success" && Array.isArray(response.files)
	}

	async hasIndexedData(): Promise<boolean> {
		try {
			const response = await this.makeRequest(`/files/${this.collectionName}`)
			return response && response.status === "success" && Array.isArray(response.files) && response.files.length > 0
		} catch {
			return false
		}
	}

	async markIndexingComplete(): Promise<void> {
		void this.vectorSize
		return
	}

	async markIndexingIncomplete(): Promise<void> {
		void this.vectorSize
		return
	}
}
