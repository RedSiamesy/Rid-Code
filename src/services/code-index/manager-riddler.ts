import * as vscode from "vscode"
import { getWorkspacePath } from "../../utils/path"
import { ContextProxy } from "../../core/config/ContextProxy"
import { VectorStoreSearchResult } from "./interfaces"
import { IndexingState } from "./interfaces/manager"
import { CodeIndexConfigManager } from "./config-manager-riddler"
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
import { aF } from "vitest/dist/chunks/reporters.d.DL9pg5DB.js"



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

		// 2. 创建一个独立的 MCP 客户端（不依赖 McpHub）
		// 这里以 code_context 配置为例，实际可根据需要动态生成
		const config = this._configManager.getConfig()
		const args = []
		args.push("-m", "code_context_mcp")

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
		if (config.openAiCompatibleOptions && config.openAiCompatibleOptions.baseUrl) {
			embeddingPromise = testEmbeddingApiAvailable({
				apiKey: config.openAiCompatibleOptions?.apiKey || "",
				model: config.modelId || "",
				baseUrl: config.openAiCompatibleOptions?.baseUrl || ""
			})
		}

		// 并发等待所有校验
		const [enhancementEnabled, rerankEnabled, embeddingEnabled] = await Promise.all([
			enhancementPromise,
			rerankPromise,
			embeddingPromise
		])
		this._isEnhancementEnabled = enhancementEnabled
		this._isRerankEnabled = rerankEnabled
		this._isEmbeddingEnabled = embeddingEnabled

		if (!this._isEmbeddingEnabled) {
			this._stateManager.setSystemState("Error", "Embedding service is not enabled.")
			return { requiresRestart }
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
		if (config.openAiCompatibleOptions && this._isEmbeddingEnabled) {
			args.push("--embedding-key", config.openAiCompatibleOptions.apiKey || "key")
			args.push("--embedding-model", config.modelId || "BAAI/bge-m3")
			args.push("--embedding-url", config.openAiCompatibleOptions.baseUrl || "http://localhost:6123/embedding/v1")
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
			this._stateManager.setSystemState("Indexed", `Codebase client initialized successfully. ${this._isRerankEnabled? "\n✔ Rerank service enabled." : ""} ${this._isEnhancementEnabled? "\n✔ Enhancement service enabled." : ""}`)
		} catch (error) {
			console.error("[CodeIndexManager] Failed to initialize MCP client:", error)
			this._stateManager.setSystemState("Error", `Codebase client initialization failed. `)
			// throw new Error("Failed to initialize MCP client")
			return { requiresRestart }
		}

		return { requiresRestart }
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
		// this._stateManager.setSystemState("Indexing", "Initializing services...")
		this._stateManager.setSystemState("Indexed", `File watcher started. ${this._isRerankEnabled? "\n✔ Rerank service enabled." : ""} ${this._isEnhancementEnabled? "\n✔ Enhancement service enabled." : ""}`)
	}

	/**
	 * Stops the file watcher and potentially cleans up resources.
	 */
	public stopWatcher(): void {
		if (!this.isFeatureEnabled) {
			return
		}
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
		// await this._orchestrator!.clearIndexData()
		// await this._cacheManager!.clearCacheFile()
	}

	// --- Private Helpers ---

	public getCurrentStatus() {
		return this._stateManager.getCurrentStatus()
	}

	public async searchIndex(query: string, directoryPrefix?: string): Promise<string[]> {
		if (!this._mcpClient) {
			throw new Error("MCP client not initialized")
		}
		const params: Record<string, any> = { queries: [query], json_format: true , rerank: this._isRerankEnabled}
		if (directoryPrefix) {
			params.directoryPrefix = directoryPrefix
		}
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
		return results
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
				await this.startIndexing()
			}
		}
	}
}

/**
 * 使用 OpenAI 官方 API 协议，发送“你好”测试大模型服务可用性。
 * @param apiKey OpenAI API Key
 * @param model OpenAI 模型名称（如 'gpt-3.5-turbo'）
 * @param baseUrl OpenAI API Base URL，默认为 https://api.openai.com/v1
 * @returns Promise<boolean>，可用返回 true，否则 false
 */
export async function testOpenAIApiAvailable({ apiKey, model, baseUrl }: { apiKey: string; model: string; baseUrl: string }): Promise<boolean> {
    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "user", content: "hello" }
                ],
                max_tokens: 16
            })
        });
        
        // 无论响应状态如何，都先尝试读取 body，避免 body 被重复读取
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("[CodeIndexManager] Failed to parse OpenAI response JSON:", parseError);
            return false;
        }
        
        // 检查响应状态和数据结构
        if (!response.ok) {
            console.error("[CodeIndexManager] OpenAI API returned error:", response.status, data);
            return false;
        }
        
        // 判断返回内容是否包含 expected 字段
        return !!(data && data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content);
    } catch (error) {
        console.error("[CodeIndexManager] OpenAI API test failed:", error);
        return false;
    }
}

/**
 * 使用 SiliconFlow Rerank API 协议，发送测试请求判断 rerank 服务可用性（新版协议，返回 results/relevance_score）。
 * @param apiKey Rerank API Key
 * @param model Rerank 模型名称（如 'BAAI/bge-reranker-v2-m3'）
 * @param baseUrl Rerank API Base URL，默认为 https://api.siliconflow.cn/v1/rerank
 * @returns Promise<boolean>，可用返回 true，否则 false
 */
export async function testRerankApiAvailable({ apiKey, model, baseUrl = "https://api.siliconflow.cn/v1" }: { apiKey: string; model: string; baseUrl?: string }): Promise<boolean> {
    try {
        const response = await fetch(`${baseUrl}/rerank`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                query: "Apple",
                documents: ["apple", "banana", "fruit", "vegetable"],
                top_n: 4,
                return_documents: false,
                max_chunks_per_doc: 1024,
                overlap_tokens: 80
            })
        });
        
        // 无论响应状态如何，都先尝试读取 body，避免 body 被重复读取
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("[CodeIndexManager] Failed to parse response JSON:", parseError);
            return false;
        }
        
        // 检查响应状态和数据结构
        if (!response.ok) {
            console.error("[CodeIndexManager] Rerank API returned error:", response.status, data);
            return false;
        }
        
        // 判断返回内容是否包含 results 且有 relevance_score 字段
        return !!(data && Array.isArray(data.results) && data.results.length > 0 && typeof data.results[0].relevance_score === "number");
    } catch (error) {
		console.error("[CodeIndexManager] Rerank API test failed:", error);
        return false;
    }
}

/**
 * 使用 OpenAI Embedding API 协议，发送测试请求判断 embedding 服务可用性。
 * @param apiKey OpenAI API Key
 * @param model Embedding 模型名称（如 'text-embedding-ada-002'）
 * @param baseUrl OpenAI API Base URL，默认为 https://api.openai.com/v1
 * @returns Promise<boolean>，可用返回 true，否则 false
 */
export async function testEmbeddingApiAvailable({ apiKey, model, baseUrl = "https://api.openai.com/v1" }: { apiKey: string; model: string; baseUrl?: string }): Promise<boolean> {
    try {
        const response = await fetch(`${baseUrl}/embeddings`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                input: "test embedding",
                encoding_format: "float"
            })
        });
        
        // 无论响应状态如何，都先尝试读取 body，避免 body 被重复读取
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("[CodeIndexManager] Failed to parse embedding response JSON:", parseError);
            return false;
        }
        
        // 检查响应状态和数据结构
        if (!response.ok) {
            console.error("[CodeIndexManager] Embedding API returned error:", response.status, data);
            return false;
        }
        
        // 判断返回内容是否包含 data 且有 embedding 字段
        return !!(data && Array.isArray(data.data) && data.data.length > 0 && Array.isArray(data.data[0].embedding) && data.data[0].embedding.length > 0);
    } catch (error) {
        console.error("[CodeIndexManager] Embedding API test failed:", error);
        return false;
    }
}
