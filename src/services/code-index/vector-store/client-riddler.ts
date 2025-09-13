import { createHash } from "crypto"
import * as path from "path"
import * as fs from "fs"
import { getWorkspacePath } from "../../../utils/path"
import { IVectorStore } from "../interfaces/vector-store"
import { Payload, VectorStoreSearchResult } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"
import { t } from "../../../i18n"
import { readLines } from "../../../integrations/misc/read-lines"
import { cwd } from "process"

import * as vscode from "vscode"

/**
 * Riddler implementation of the vector store interface
 */
export class RiddlerVectorStore implements IVectorStore {
	private readonly vectorSize!: number
	private readonly DISTANCE_METRIC = "Cosine"

	private readonly collectionName: string
	private readonly riddlerUrl: string = "http://localhost:8000"
	private readonly apiKey?: string
	private readonly workspacePath: string

	/**
	 * Creates a new Riddler vector store
	 * @param workspacePath Path to the workspace
	 * @param url Optional URL to the Riddler server
	 */
	constructor(workspacePath: string, url: string, vectorSize: number, apiKey?: string) {
		// Parse the URL to determine the appropriate Riddler server URL
		const parsedUrl = this.parseRiddlerUrl(url)

		// Store the resolved URL for our property
		this.riddlerUrl = parsedUrl
		this.apiKey = apiKey

		// Generate collection name from workspace path
		const hash = createHash("sha256").update(`${vscode.env.machineId}@${workspacePath}`).digest("hex")
		this.vectorSize = vectorSize
		this.collectionName = `ws-${hash.substring(0, 16)}`
		this.workspacePath = workspacePath
	}

	/**
	 * Parses and normalizes Riddler server URLs to handle various input formats
	 * @param url Raw URL input from user
	 * @returns Properly formatted URL for Riddler client
	 */
	private parseRiddlerUrl(url: string | undefined): string {
		// Handle undefined/null/empty cases
		if (!url || url.trim() === "") {
			return "http://localhost:8000"
		}

		const trimmedUrl = url.trim()

		// Check if it starts with a protocol
		if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://") && !trimmedUrl.includes("://")) {
			// No protocol - treat as hostname
			return this.parseHostname(trimmedUrl)
		}

		try {
			// Attempt to parse as complete URL - return as-is
			new URL(trimmedUrl)
			return trimmedUrl
		} catch {
			// Failed to parse as URL - treat as hostname
			return this.parseHostname(trimmedUrl)
		}
	}

	/**
	 * Handles hostname-only inputs
	 * @param hostname Raw hostname input
	 * @returns Properly formatted URL with http:// prefix
	 */
	private parseHostname(hostname: string): string {
		if (hostname.includes(":")) {
			// Has port - add http:// prefix if missing
			return hostname.startsWith("http") ? hostname : `http://${hostname}`
		} else {
			// No port - add http:// prefix without port (let Riddler handle default port)
			return `http://${hostname}`
		}
	}

	/**
	 * Makes an HTTP request to the Riddler service
	 */
	private async makeRequest(endpoint: string, method: string = "GET", body?: any): Promise<any> {
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

		try {
			const response = await fetch(url, config)
			
			if (!response.ok) {
				const errorText = await response.text()
				throw new Error(`HTTP ${response.status}: ${errorText}`)
			}

			// Check if response has content
			const contentType = response.headers.get("content-type")
			if (contentType && contentType.includes("application/json")) {
				return await response.json()
			} else {
				return await response.text()
			}
		} catch (error) {
			console.error(`[RiddlerVectorStore] Request failed for ${endpoint}:`, error)
			throw error
		}
	}

	/**
	 * Initializes the vector store
	 * @returns Promise resolving to boolean indicating if a new collection was created
	 */
	async initialize(): Promise<boolean> {
		try {
			// Check if collection exists by trying to get files
			try {
				const response = await this.makeRequest(`/files/${this.collectionName}`)
				if (response && response.status == "success" && Array.isArray(response.files)) {
					return false // Collection already exists, no new collection was created
				}
				return true
			} catch (error: any) {
				throw error
			}
		} catch (error: any) {
			const errorMessage = error?.message || error
			console.error(
				`[RiddlerVectorStore] Failed to initialize Riddler collection "${this.collectionName}":`,
				errorMessage,
			)

			throw new Error(
				`连接 Codebase-Service 失败。请确保 Codebase-Service 正在运行并可在 ${this.riddlerUrl} 访问。错误：${errorMessage}`
			)
		}
	}

	/**
	 * Upserts points into the vector store
	 * @param points Array of points to upsert
	 */
	async upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, any>
		}>,
	): Promise<void> {
		try {
			// Group points by file path for batch processing
			const fileGroups = new Map<string, Array<{ id: string; vector: number[]; payload: Record<string, any> }>>()
			
			for (const point of points) {
				const filePath = point.payload?.filePath
				if (!filePath) {
					console.warn("[RiddlerVectorStore] Point without filePath, skipping:", point.id)
					continue
				}

				if (!fileGroups.has(filePath)) {
					fileGroups.set(filePath, [])
				}
				fileGroups.get(filePath)!.push(point)
			}

			// Process each file group
			for (const [filePath, filePoints] of fileGroups) {
				// Reconstruct file content from points
				const sortedPoints = filePoints.sort((a, b) => 
					(a.payload.startLine || 0) - (b.payload.startLine || 0)
				)
				
				const content = sortedPoints.map(point => point.payload.codeChunk || "").join("\n")

				await this.makeRequest("/add_file", "POST", {
					collection_name: this.collectionName,
					file_path: filePath,
					content: content,
					need_enhancement: true,
				})
			}
		} catch (error) {
			console.error("[RiddlerVectorStore] Failed to upsert points:", error)
			throw error
		}
	}

	// /**
	//  * Checks if a payload is valid
	//  * @param payload Payload to check
	//  * @returns Boolean indicating if the payload is valid
	//  */
	// private isPayloadValid(payload: Record<string, unknown> | null | undefined): payload is Payload {
	// 	if (!payload) {
	// 		return false
	// 	}
	// 	const validKeys = ["filePath", "codeChunk", "startLine", "endLine"]
	// 	const hasValidKeys = validKeys.every((key) => key in payload)
	// 	return hasValidKeys
	// }

	/**
	 * Searches for similar vectors
	 * @param queryVector Vector to search for
	 * @param directoryPrefix Optional directory prefix to filter results
	 * @param minScore Optional minimum score threshold
	 * @param maxResults Optional maximum number of results to return
	 * @returns Promise resolving to search results
	 */
	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
		query?:string,
	): Promise<VectorStoreSearchResult[]> {
		try {
			// Convert vector to query strings (this is a simplified approach)
			// In real implementation, you might want to use the embedding to generate text queries
			const queries = [query] 

			let paths: string[] = []
			if (directoryPrefix) {
				// Check if the path represents current directory
				const normalizedPrefix = path.posix.normalize(directoryPrefix.replace(/\\/g, "/"))
				if (normalizedPrefix !== "." && normalizedPrefix !== "./") {
					paths = [directoryPrefix]
				}
			}

			const searchRequest = {
				collection_name: this.collectionName,
				queries: queries,
				n_results: maxResults ?? DEFAULT_MAX_SEARCH_RESULTS,
				padding: 3,
				threshold: minScore ?? DEFAULT_SEARCH_MIN_SCORE,
				rerank_enable: false,
				paths: paths
			}

			const response = await this.makeRequest("/search", "POST", searchRequest)
			
			// Convert Riddler response to VectorStoreSearchResult format
			const results: VectorStoreSearchResult[] = []
			if (response && response.data) {
				for (const result of response.data) {
					const file_path = path.resolve(this.workspacePath, result.file_path)
					const score = result.score
					const lines = result.lines

					// lines是行号
					// codeChunk 需要读取 file_path 中的所有lines的行，并打上行号 打行号可以参考readfile工具
					// startLine取lines最小值，endLine取lines最大值 
					// 如上共同组成一个结果
					
					if (!lines || lines.length === 0) {
						continue
					}

					try {
						// 读取文件内容并获取指定行的内容
						// 使用 readLines 函数读取指定行范围
						const startLine = Math.min(...lines)
						const endLine = Math.max(...lines)
						const Lines = new Set<number>()

						// 对行号进行排序
						const sortedLines = [...lines].sort((a, b) => a - b)
						
						// 读取整个范围的内容
						const rawContent = await readLines(file_path, endLine - 1, startLine - 1)
						const allLines = rawContent.split('\n')
						
						// 构建 codeChunk，只包含指定的行，不连续处添加 "..."
						const codeChunkLines: string[] = []
						let prevLineNumber = -1
						
						for (const lineNumber of sortedLines) {
							// 检查是否需要添加省略号
							if (prevLineNumber !== -1 && lineNumber > prevLineNumber + 1) {
								codeChunkLines.push("...")
							}
							
							// 计算在 allLines 中的索引（相对于 startLine）
							const lineIndex = lineNumber - startLine
							if (lineIndex >= 0 && lineIndex < allLines.length) {
								// 添加带行号的内容
								const lineNumberWidth = String(endLine).length
								const formattedLineNumber = String(lineNumber).padStart(lineNumberWidth, " ")
								codeChunkLines.push(`${formattedLineNumber} | ${allLines[lineIndex]}`)
								Lines.add(lineNumber)
							}
							
							prevLineNumber = lineNumber
						}
						
						// 组装最终的 codeChunk
						const codeChunk = codeChunkLines.join('\n') + '\n'

						// 创建搜索结果
						results.push({
							id: `${file_path}:${startLine}:${Math.max(...Lines)}`,
							score: score || 0,
							payload: {
								filePath: file_path,
								codeChunk: codeChunk,
								startLine: startLine,
								endLine: Math.max(...Lines)
							}
						})
					} catch (fileError) {
						console.warn(`[RiddlerVectorStore] Failed to read file ${file_path}:`, fileError)
						// 如果文件读取失败，跳过这个结果
						continue
					}
				}
			}

			return results
		} catch (error) {
			console.error("[RiddlerVectorStore] Failed to search points:", error)
			throw error
		}
	}

	async summary(
		directoryPrefix?: string,
	): Promise<VectorStoreSearchResult[]> {
		try {
			const body: any = {
				collection_name: this.collectionName,
				paths: directoryPrefix ? [directoryPrefix] : null
			}
			const response = await this.makeRequest("/summary", "POST", body)
			
			// Summary 端点返回格式与 search 类似，从 data 中取 file_path 和 code 字段
			const results: VectorStoreSearchResult[] = []
			if (response && response.data) {
				for (const result of response.data) {
					if (result.file_path) {
						results.push({
							id: `${result.file_path}`,
							score: 1,
							payload: {
								filePath: result.file_path,
								codeChunk: result.code.join("\n"),
								startLine: 0,
								endLine: 0
							}
						})
					}
				}
			}
			return results
		} catch (error) {
			console.error("[RiddlerVectorStore] Failed to get summary:", error)
			return []
		}
	}

	/**
	 * Deletes points by file path
	 * @param filePath Path of the file to delete points for
	 */
	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) {
			return
		}

		try {
			// Use the delete_files endpoint to remove specific files from the collection
			const response = await this.makeRequest("/delete_files", "POST", {
				collection_name: this.collectionName,
				file_paths: filePaths
			})

			if (response && response.status === "success") {
			} else {
				console.warn(`[RiddlerVectorStore] Unexpected response when deleting files:`, response)
			}
		} catch (error: any) {
			console.error(`[RiddlerVectorStore] Failed to delete points by file paths:`, error)
			throw error
		}
	}

	/**
	 * Deletes the entire collection.
	 */
	async deleteCollection(): Promise<void> {
		try {
			await this.makeRequest(`/delete/${this.collectionName}`, "POST")
		} catch (error) {
			console.error(`[RiddlerVectorStore] Failed to delete collection ${this.collectionName}:`, error)
			throw error
		}
	}

	/**
	 * Clears all points from the collection
	 */
	async clearCollection(): Promise<void> {
		try {
			// Delete and recreate collection to clear it
			await this.deleteCollection()
		} catch (error) {
			console.error("[RiddlerVectorStore] Failed to clear collection:", error)
			throw error
		}
	}

	/**
	 * Checks if the collection exists
	 * @returns Promise resolving to boolean indicating if the collection exists
	 */
	async collectionExists(): Promise<boolean> {
		try {
			const response = await this.makeRequest(`/files/${this.collectionName}`)
			if (response && response.status == "success" && Array.isArray(response.files)) {
				return true // Collection already exists, no new collection was created
			}
			return false
		} catch (error: any) {
			throw error
		}
	}
}
