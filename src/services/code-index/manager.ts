import * as vscode from "vscode"
import { getWorkspacePath } from "../../utils/path"
import { ContextProxy } from "../../core/config/ContextProxy"
import { VectorStoreSearchResult } from "./interfaces"
import { IndexingState } from "./interfaces/manager"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager } from "./state-manager"
import { CodeIndexServiceFactory } from "./service-factory"
import { CodeIndexSearchService } from "./search-service"
import { CodeIndexOrchestrator } from "./orchestrator"
import { CacheManager } from "./cache-manager"
import fs from "fs/promises"
import ignore from "ignore"
import path from "path"
import { z } from "zod"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"
import { testEmbeddingApiAvailable, testOpenAIApiAvailable, testRerankApiAvailable } from "./manager-test-rid"



export class CodeIndexManager {
	// --- Singleton Implementation ---
	private static instances = new Map<string, CodeIndexManager>() // Map workspace path to instance

	// Specialized class instances
	private _configManager: CodeIndexConfigManager | undefined
	private readonly _stateManager: CodeIndexStateManager

	private _mcpClient : Client | undefined
	// private _serviceFactory: CodeIndexServiceFactory | undefined
	// private _orchestrator: CodeIndexOrchestrator | undefined
	// private _searchService: CodeIndexSearchService | undefined
	// private _cacheManager: CacheManager | undefined

	private _isEnhancementEnabled: boolean = false
	private _isRerankEnabled: boolean = false
	private _isEmbeddingEnabled: boolean = false

	public static getInstance(context: vscode.ExtensionContext): CodeIndexManager | undefined {
		const workspacePath = getWorkspacePath() // Assumes single workspace for now

		if (!workspacePath) {
			return undefined
		}

		if (!CodeIndexManager.instances.has(workspacePath)) {
			CodeIndexManager.instances.set(workspacePath, new CodeIndexManager(workspacePath, context))
		}
		return CodeIndexManager.instances.get(workspacePath)!
	}

	public static disposeAll(): void {
		for (const instance of CodeIndexManager.instances.values()) {
			instance.dispose()
		}
		CodeIndexManager.instances.clear()
	}

	private readonly workspacePath: string
	private readonly context: vscode.ExtensionContext

	// Private constructor for singleton pattern
	private constructor(workspacePath: string, context: vscode.ExtensionContext) {
		this.workspacePath = workspacePath
		this.context = context
		this._stateManager = new CodeIndexStateManager()
	}

	// --- Public API ---

	public get onProgressUpdate() {
		return this._stateManager.onProgressUpdate
	}

	private assertInitialized() {
		if (!this._configManager) {
			throw new Error("CodeIndexManager not initialized. Call initialize() first.")
		}
	}

	public get state(): IndexingState {
		return this._stateManager.state
	}


	public get isInitialized(): boolean {
		try {
			this.assertInitialized()
			return true
		} catch (error) {
			return false
		}
	}

	public get isFeatureEnabled(): boolean {
		return this._configManager?.isFeatureEnabled ?? false
	}

	public get isFeatureConfigured(): boolean {
		return this._configManager?.isFeatureConfigured ?? false
	}

	/**
	 * Initializes the manager with configuration and dependent services.
	 * Must be called before using any other methods.
	 * @returns Object indicating if a restart is needed
	 */
	public async initialize(contextProxy: ContextProxy): Promise<{ requiresRestart: boolean }> {
		// 1. ConfigManager Initialization and Configuration Loading
		if (!this._configManager) {
			this._configManager = new CodeIndexConfigManager(contextProxy)
		}
		// Load configuration once to get current state and restart requirements
		const { requiresRestart } = await this._configManager.loadConfiguration()

		this._stateManager.setSystemState("Indexing", "Checking configuration.")

		// 2. 创建一个独立的 MCP 客户端（不依赖 McpHub）
		// 这里以 code_context 配置为例，实际可根据需要动态生成
		const config = this._configManager.getConfig()

		// --- 三个服务可用性校验并发执行 ---
		let enhancementPromise: Promise<boolean> = Promise.resolve(false)
		let rerankPromise: Promise<boolean> = Promise.resolve(false)
		let embeddingPromise: Promise<boolean> = Promise.resolve(false)

		if (config.enhancementOptions && config.enhancementOptions.baseUrl) {
			enhancementPromise = testOpenAIApiAvailable({
				apiKey: config.enhancementOptions?.apiKey || "",
				model: config.enhancementOptions?.modelID || "",
				baseUrl: config.enhancementOptions?.baseUrl || ""
			})
		}
		if (config.rerankOptions && config.rerankOptions.baseUrl) {
			rerankPromise = testRerankApiAvailable({
				apiKey: config.rerankOptions?.apiKey || "",
				model: config.rerankOptions?.modelID || "",
				baseUrl: config.rerankOptions?.baseUrl || ""
			})
		}
		if (config.embeddingOptions && config.embeddingOptions.baseUrl) {
			embeddingPromise = testEmbeddingApiAvailable({
				apiKey: config.embeddingOptions?.apiKey || "",
				model: config.embeddingOptions?.modelID || "",
				baseUrl: config.embeddingOptions?.baseUrl || ""
			})
		}

		// 并发等待所有校验
		const [enhancementEnabled, rerankEnabled, embeddingEnabled] = await Promise.all([
			enhancementPromise,
			rerankPromise,
			embeddingPromise,
		])
		this._isEnhancementEnabled = enhancementEnabled
		this._isRerankEnabled = rerankEnabled
		this._isEmbeddingEnabled = embeddingEnabled

		this.startIndexing()

		return { requiresRestart }
	}

	public async _startIndexing(): Promise<void> {
		if (!this._configManager) {
			this._stateManager.setSystemState("Error", "Config error.")
			return
		}

		if (this._mcpClient !== undefined) {
			this._stateManager.setSystemState("Indexed", `Codebase client initialized successfully. ${this._isRerankEnabled? "\n  ✔ Rerank service enabled." : ""} ${this._isEnhancementEnabled? "\n  ✔ Enhancement service enabled." : ""}`)
			return
		}

		const config = this._configManager.getConfig()
		const args = []
		args.push("-m", "code_context_mcp")

		if (!this._isEmbeddingEnabled) {
			this._stateManager.setSystemState("Error", "Embedding service is not enabled.")
		}
		if (config.enhancementOptions && this._isEnhancementEnabled) {
			args.push("--is-enhancement")
			args.push("--enhancement-key", config.enhancementOptions.apiKey || "key")
			args.push("--enhancement-model", config.enhancementOptions.modelID || "qwq-32b")
			args.push("--enhancement-url", config.enhancementOptions.baseUrl || "http://10.12.154.110:7000/v1")
		}
		if (config.rerankOptions && this._isRerankEnabled) {
			args.push("--rerank-key", config.rerankOptions.apiKey || "key")
			args.push("--rerank-model", config.rerankOptions.modelID || "BAAI/bge-reranker-v2-m3")
			args.push("--rerank-url", config.rerankOptions.baseUrl || "http://localhost:6123/rerank/v1")
		}
		if (config.embeddingOptions && this._isEmbeddingEnabled) {
			args.push("--embedding-key", config.embeddingOptions.apiKey || "key")
			args.push("--embedding-model", config.embeddingOptions.modelID || "BAAI/bge-m3")
			args.push("--embedding-url", config.embeddingOptions.baseUrl || "http://localhost:6123/embedding/v1")
		}
		if (config.ragPath) {
			args.push("--rag-path", config.ragPath)
		}
		if (config.codeBaseLogging) {
			args.push("--log")
		}

		const mcpConfig = {
			command: "python",
			args
		}
		const transport = new StdioClientTransport({
			command: mcpConfig.command,
			args: mcpConfig.args,
			// env: mcpConfig.env,
			cwd: this.workspacePath,
			stderr: "pipe",
		})
		try {
			const client = new Client({ name: "CodeIndexManager", version: "0.1.0" }, { capabilities: {} })
			// await transport.start()
			await client.connect(transport)
			// 你可以将 client 实例保存到 this._mcpClient 以便后续调用
			this._mcpClient = client
			this._stateManager.setSystemState("Indexed", `Codebase client initialized successfully. ${this._isRerankEnabled? "\n  ✔ Rerank service enabled." : ""} ${this._isEnhancementEnabled? "\n  ✔ Enhancement service enabled." : ""}`)
		} catch (error) {
			console.error("[CodeIndexManager] Failed to initialize MCP client:", error)
			this._stateManager.setSystemState("Error", `Codebase client initialization failed. ${error}`)
			// throw new Error("Failed to initialize MCP client")
		}
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */

	public async startIndexing(): Promise<void> {
		if (!this.isFeatureEnabled) {
			return
		}
		this.assertInitialized()
		if (!this.isFeatureConfigured) {
			this._stateManager.setSystemState("Standby", "Missing configuration. Save your settings to start indexing.")
			console.warn("[CodeIndexOrchestrator] Start rejected: Missing configuration.")
			return
		}
		this._stateManager.setSystemState("Indexing", "Start Indexing...")
		this._startIndexing()
		// this._stateManager.setSystemState("Indexing", "Initializing services...")
		// this._stateManager.setSystemState("Indexed", `File watcher started. ${this._isRerankEnabled? "\n  ✔ Rerank service enabled." : ""} ${this._isEnhancementEnabled? "\n  ✔ Enhancement service enabled." : ""}`)
	}

	/**
	 * Stops the file watcher and potentially cleans up resources.
	 */
	public stopWatcher(): void {
		// if (!this.isFeatureEnabled) {
		// 	return
		// }
		this._stateManager.setSystemState("Standby", "File watcher stopped.")
		if (this._mcpClient) {
			this._mcpClient.close() // Disconnect the MCP client
			this._mcpClient = undefined // Clear the client reference
		}
	}

	/**
	 * Cleans up the manager instance.
	 */
	public dispose(): void {
		this.stopWatcher()
		this._stateManager.dispose()
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the Qdrant collection,
	 * and deleting the cache file.
	 */
	public async clearIndexData(): Promise<void> {
		if (!this.isFeatureEnabled) {
			return
		}
		this.assertInitialized()

		if (!this._mcpClient) {
			throw new Error("MCP client not initialized")
		}

		try {
			const response = await this._mcpClient.request(
				{
					method: "tools/call",
					params: {
						name: "delete_index",
					}
				},
				CallToolResultSchema
			)

			const results: string[] = []
			if (response && Array.isArray(response.content)) {
				for (const item of response.content) {
					if (item && typeof item.text === "string") {
						results.push(item.text)
					}
				}
			}

			if (response.isError) {
				console.error("[CodeIndexManager] MCP delete_index error:" + results.join(", "))
				throw new Error("MCP delete_index returned an error:" + results.join(", "))
			}
		} catch (error) {
			console.error("[CodeIndexManager] searchSummary exception:", error)
			throw error
		}

		await this.stopWatcher()
	}

	// --- Private Helpers ---

	public getCurrentStatus() {
		return this._stateManager.getCurrentStatus()
	}

	public async searchIndex(query: string, directoryPrefix?: string): Promise<string[]> {
		if (!this._mcpClient) {
			throw new Error("MCP client not initialized")
		}

		
		if (!this._configManager) {
			this._stateManager.setSystemState("Error", "Config error.")
			throw new Error("Config error.")
		}

		const config = this._configManager.getConfig()

		

		// const params: Record<string, any> = { queries: [query], json_format: true , rerank_enable: this._isRerankEnabled}
		const params: Record<string, any> = { 
			queries: query.split("|").map(q => q.trim()), 
			json_format: true, 
			rerank_enable: this._isRerankEnabled 
		}

		if (config.llmFilter) {
			params.llm_filter = config.llmFilter
		}

		if (directoryPrefix) {
			params.paths = [directoryPrefix]
		}

		try {
			const response = await this._mcpClient.request(
				{
					method: "tools/call",
					params: {
						name: "search_code",
						arguments: params
					}
				},
				CallToolResultSchema
			)

			const results: string[] = []
			if (response && Array.isArray(response.content)) {
				for (const item of response.content) {
					if (item && typeof item.text === "string") {
						results.push(item.text)
					}
				}
			}

			if (response.isError) {
				console.error("[CodeIndexManager] MCP search_code error:" + results.join(", "))
				throw new Error("MCP search_code returned an error:" + results.join(", "))
			}

			return results
		} catch (error) {
			console.error("[CodeIndexManager] searchIndex exception:", error)
			throw error
		}
	}

	public async searchSummary(directoryPrefix: string): Promise<string[]> {
		if (!this._mcpClient) {
			throw new Error("MCP client not initialized")
		}

		// const params: Record<string, any> = { queries: [query], json_format: true , rerank_enable: this._isRerankEnabled}
		const params: Record<string, any> = { 
			json_format: true, 
			paths: [directoryPrefix],
		}

		try {
			const response = await this._mcpClient.request(
				{
					method: "tools/call",
					params: {
						name: "get_summary",
						arguments: params
					}
				},
				CallToolResultSchema
			)

			const results: string[] = []
			if (response && Array.isArray(response.content)) {
				for (const item of response.content) {
					if (item && typeof item.text === "string") {
						results.push(item.text)
					}
				}
			}

			if (response.isError) {
				console.error("[CodeIndexManager] MCP get_summary error:" + results.join(", "))
				throw new Error("MCP get_summary returned an error:" + results.join(", "))
			}

			return results
		} catch (error) {
			console.error("[CodeIndexManager] searchSummary exception:", error)
			throw error
		}
	}

	/**
	 * Handles external settings changes by reloading configuration.
	 * This method should be called when API provider settings are updated
	 * to ensure the CodeIndexConfigManager picks up the new configuration.
	 * If the configuration changes require a restart, the service will be restarted.
	 */
	public async handleExternalSettingsChange(): Promise<void> {
		if (this._configManager) {
			const { requiresRestart } = await this._configManager.loadConfiguration()

			const isFeatureEnabled = this.isFeatureEnabled
			const isFeatureConfigured = this.isFeatureConfigured

			// If configuration changes require a restart and the manager is initialized, restart the service
			if (requiresRestart && isFeatureEnabled && isFeatureConfigured && this.isInitialized) {
				this.stopWatcher()
				const contextProxy = await ContextProxy.getInstance(this.context)
				await this.initialize(contextProxy)
				// await this.startIndexing()
			} else if (!isFeatureEnabled) {
				this._stateManager.setSystemState("Standby", "File watcher stopped.")
				this.stopWatcher()
			}
		}
	}
}
