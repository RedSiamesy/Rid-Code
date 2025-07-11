import { ApiHandlerOptions } from "../../shared/api"
import { ContextProxy } from "../../core/config/ContextProxy"
import { EmbedderProvider } from "./interfaces/manager"
import { CodeIndexConfig, PreviousConfigSnapshot } from "./interfaces/config"
import { SEARCH_MIN_SCORE } from "./constants"
import { getDefaultModelId, getModelDimension } from "../../shared/embeddingModels"

/**
 * Manages configuration state and validation for the code indexing feature.
 * Handles loading, validating, and providing access to configuration values.
 */
export class CodeIndexConfigManager {
	private isEnabled: boolean = false
	private embedderProvider: EmbedderProvider = "openai"
	private modelId?: string
	private openAiOptions?: ApiHandlerOptions
	private ollamaOptions?: ApiHandlerOptions
	private openAiCompatibleOptions?: { baseUrl: string; apiKey: string; modelDimension?: number }
	private qdrantUrl?: string = "http://localhost:6333"
	private qdrantApiKey?: string
	private searchMinScore?: number

	private embeddingOptions?: { baseUrl: string; apiKey: string; modelID: string }
	private enhancementOptions?: { baseUrl: string; apiKey: string; modelID: string }
	private rerankOptions?: { baseUrl: string; apiKey: string; modelID: string }
	private ragPath?: string
	private llmFilter?: boolean
	private codeBaseLogging?: boolean

	constructor(private readonly contextProxy: ContextProxy) {
		// Initialize with current configuration to avoid false restart triggers
		this._loadAndSetConfiguration()
	}

	/**
	 * Private method that handles loading configuration from storage and updating instance variables.
	 * This eliminates code duplication between initializeWithCurrentConfig() and loadConfiguration().
	 */
	private _loadAndSetConfiguration(): void {
		// Load configuration from storage
		const codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig") ?? {
			codebaseIndexEnabled: false,
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexSearchMinScore: 0.4,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexEmbedderBaseUrl: "",
			codebaseIndexEmbedderModelId: "",

			embeddingBaseUrl: "",
			embeddingModelID: "",
			enhancementBaseUrl: "",
			enhancementModelID: "",
			rerankBaseUrl: "",
			rerankModelID: "",
			ragPath: "",
			llmFilter: false,
			codeBaseLogging: false,
		}

		const {
			codebaseIndexEnabled,
			codebaseIndexQdrantUrl,
			codebaseIndexEmbedderProvider,
			codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId,

			embeddingBaseUrl,
			embeddingModelID,
			enhancementBaseUrl,
			enhancementModelID,
			rerankBaseUrl,
			rerankModelID,
			ragPath,
			llmFilter,
			codeBaseLogging,
		} = codebaseIndexConfig

		const openAiKey = this.contextProxy?.getSecret("codeIndexOpenAiKey") ?? ""
		const qdrantApiKey = this.contextProxy?.getSecret("codeIndexQdrantApiKey") ?? ""
		const openAiCompatibleBaseUrl = this.contextProxy?.getGlobalState("codebaseIndexOpenAiCompatibleBaseUrl") ?? ""
		const openAiCompatibleApiKey = this.contextProxy?.getSecret("codebaseIndexOpenAiCompatibleApiKey") ?? ""
		const openAiCompatibleModelDimension = this.contextProxy?.getGlobalState(
			"codebaseIndexOpenAiCompatibleModelDimension",
		) as number | undefined

		const embeddingApiKey = this.contextProxy?.getSecret("embeddingApiKey") ?? ""
		const enhancementApiKey = this.contextProxy?.getSecret("enhancementApiKey") ?? ""
		const rerankApiKey = this.contextProxy?.getSecret("rerankApiKey") ?? ""

		// Update instance variables with configuration
		this.isEnabled = codebaseIndexEnabled || false
		this.qdrantUrl = codebaseIndexQdrantUrl
		this.qdrantApiKey = qdrantApiKey ?? ""
		this.openAiOptions = { openAiNativeApiKey: openAiKey }
		this.searchMinScore = SEARCH_MIN_SCORE

		// Set embedder provider with support for openai-compatible
		if (codebaseIndexEmbedderProvider === "ollama") {
			this.embedderProvider = "ollama"
		} else if (codebaseIndexEmbedderProvider === "openai-compatible") {
			this.embedderProvider = "openai-compatible"
		} else {
			this.embedderProvider = "openai"
		}

		this.modelId = codebaseIndexEmbedderModelId || undefined

		this.ollamaOptions = {
			ollamaBaseUrl: codebaseIndexEmbedderBaseUrl,
		}

		this.embeddingOptions =
			embeddingBaseUrl && embeddingApiKey && embeddingModelID
				? {
						baseUrl: embeddingBaseUrl,
						apiKey: embeddingApiKey,
						modelID: embeddingModelID,
					}
				: undefined

		this.enhancementOptions =
			enhancementBaseUrl && enhancementApiKey && enhancementModelID
				? {
						baseUrl: enhancementBaseUrl,
						apiKey: enhancementApiKey,
						modelID: enhancementModelID,
					}
				: undefined

		this.rerankOptions =
			rerankBaseUrl && rerankApiKey && rerankModelID
				? {
						baseUrl: rerankBaseUrl,
						apiKey: rerankApiKey,
						modelID: rerankModelID,
					}
				: undefined

		this.ragPath = ragPath ? ragPath : undefined
		this.llmFilter = llmFilter ? llmFilter : false
		this.codeBaseLogging = codeBaseLogging ? codeBaseLogging : false
	}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<{
		configSnapshot: PreviousConfigSnapshot
		currentConfig: {
			isEnabled: boolean
			isConfigured: boolean
			embedderProvider: EmbedderProvider
			modelId?: string
			openAiOptions?: ApiHandlerOptions
			ollamaOptions?: ApiHandlerOptions
			openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
			qdrantUrl?: string
			qdrantApiKey?: string
			searchMinScore?: number
		}
		requiresRestart: boolean
	}> {
		// Capture the ACTUAL previous state before loading new configuration
		const previousConfigSnapshot: PreviousConfigSnapshot = {
			enabled: this.isEnabled,
			configured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			openAiKey: this.openAiOptions?.openAiNativeApiKey ?? "",
			ollamaBaseUrl: this.ollamaOptions?.ollamaBaseUrl ?? "",
			openAiCompatibleBaseUrl: this.openAiCompatibleOptions?.baseUrl ?? "",
			openAiCompatibleApiKey: this.openAiCompatibleOptions?.apiKey ?? "",
			openAiCompatibleModelDimension: this.openAiCompatibleOptions?.modelDimension,
			qdrantUrl: this.qdrantUrl ?? "",
			qdrantApiKey: this.qdrantApiKey ?? "",

			embeddingApiKey: this.embeddingOptions?.apiKey ?? "",
			embeddingBaseUrl: this.embeddingOptions?.baseUrl ?? "",
			embeddingModelID: this.embeddingOptions?.modelID ?? "",

			enhancementApiKey: this.enhancementOptions?.apiKey ?? "",
			enhancementBaseUrl: this.enhancementOptions?.baseUrl ?? "",
			enhancementModelID: this.enhancementOptions?.modelID ?? "",

			rerankBaseUrl: this.rerankOptions?.baseUrl ?? "",
			rerankApiKey: this.rerankOptions?.apiKey ?? "",
			rerankModelID: this.rerankOptions?.modelID ?? "",

			ragPath: this.ragPath ?? "",
			llmFilter: this.llmFilter ?? false,
			codeBaseLogging: this.codeBaseLogging ?? false
		}

		// Load new configuration from storage and update instance variables
		this._loadAndSetConfiguration()

		const requiresRestart = this.doesConfigChangeRequireRestart(previousConfigSnapshot)

		return {
			configSnapshot: previousConfigSnapshot,
			currentConfig: {
				isEnabled: this.isEnabled,
				isConfigured: this.isConfigured(),
				embedderProvider: this.embedderProvider,
				modelId: this.modelId,
				openAiOptions: this.openAiOptions,
				ollamaOptions: this.ollamaOptions,
				openAiCompatibleOptions: this.openAiCompatibleOptions,
				qdrantUrl: this.qdrantUrl,
				qdrantApiKey: this.qdrantApiKey,
				searchMinScore: this.searchMinScore,
			},
			requiresRestart,
		}
	}

	/**
	 * Checks if the service is properly configured based on the embedder type.
	 */
	public isConfigured(): boolean {
		if (this.embedderProvider === "openai") {
			const openAiKey = this.openAiOptions?.openAiNativeApiKey
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(openAiKey && qdrantUrl)
			return isConfigured
		} else if (this.embedderProvider === "ollama") {
			// Ollama model ID has a default, so only base URL is strictly required for config
			const ollamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(ollamaBaseUrl && qdrantUrl)
			return isConfigured
		} else if (this.embedderProvider === "openai-compatible") {
			const baseUrl = this.embeddingOptions?.baseUrl
			const apiKey = this.embeddingOptions?.apiKey
			const modelID = this.embeddingOptions?.modelID
			return !!(baseUrl && apiKey && modelID)
		}
		return false // Should not happen if embedderProvider is always set correctly
	}

	/**
	 * Determines if a configuration change requires restarting the indexing process.
	 */
	doesConfigChangeRequireRestart(prev: PreviousConfigSnapshot): boolean {
		const nowConfigured = this.isConfigured()

		// Handle null/undefined values safely - use empty strings for consistency with loaded config
		const prevEnabled = prev?.enabled ?? false
		const prevConfigured = prev?.configured ?? false
		const prevProvider = prev?.embedderProvider ?? "openai"
		const prevModelId = prev?.modelId ?? undefined
		const prevOpenAiKey = prev?.openAiKey ?? ""
		const prevOllamaBaseUrl = prev?.ollamaBaseUrl ?? ""
		const prevOpenAiCompatibleBaseUrl = prev?.openAiCompatibleBaseUrl ?? ""
		const prevOpenAiCompatibleApiKey = prev?.openAiCompatibleApiKey ?? ""
		const prevOpenAiCompatibleModelDimension = prev?.openAiCompatibleModelDimension
		const prevQdrantUrl = prev?.qdrantUrl ?? ""
		const prevQdrantApiKey = prev?.qdrantApiKey ?? ""

		const prevembeddingApiKey = prev?.embeddingApiKey ?? ""
		const prevembeddingBaseUrl = prev?.embeddingBaseUrl ?? ""
		const prevembeddingModelID = prev?.embeddingModelID ?? ""

		const prevenhancementApiKey = prev?.enhancementApiKey ?? ""
		const prevenhancementBaseUrl = prev?.enhancementBaseUrl ?? ""
		const prevenhancementModelID = prev?.enhancementModelID ?? ""

		const prevrerankBaseUrl = prev?.rerankBaseUrl ?? ""
		const prevrerankApiKey = prev?.rerankApiKey ?? ""
		const prevrerankModelID = prev?.rerankModelID ?? ""

		const prevragPath = prev?.ragPath ?? ""
		const prevcodeBaseLogging = prev?.codeBaseLogging ?? false

		// 1. Transition from disabled/unconfigured to enabled+configured
		if ((!prevEnabled || !prevConfigured) && this.isEnabled && nowConfigured) {
			return true
		}

		// 2. If was disabled and still is, no restart needed
		if (!prevEnabled && !this.isEnabled) {
			return false
		}

		// 3. If wasn't ready before and isn't ready now, no restart needed
		if (!prevConfigured && !nowConfigured) {
			return false
		}

		// 4. Check for changes in relevant settings if the feature is enabled (or was enabled)
		if (this.isEnabled || prevEnabled) {
			// Provider change
			if (prevProvider !== this.embedderProvider) {
				return true
			}

			if (this._hasVectorDimensionChanged(prevProvider, prevModelId)) {
				return true
			}

			// Authentication changes
			if (this.embedderProvider === "openai") {
				const currentOpenAiKey = this.openAiOptions?.openAiNativeApiKey ?? ""
				if (prevOpenAiKey !== currentOpenAiKey) {
					return true
				}
			}

			if (this.embedderProvider === "ollama") {
				const currentOllamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl ?? ""
				if (prevOllamaBaseUrl !== currentOllamaBaseUrl) {
					return true
				}
			}

			if (this.embedderProvider === "openai-compatible") {
				const currentOpenAiCompatibleBaseUrl = this.openAiCompatibleOptions?.baseUrl ?? ""
				const currentOpenAiCompatibleApiKey = this.openAiCompatibleOptions?.apiKey ?? ""
				const currentOpenAiCompatibleModelDimension = this.openAiCompatibleOptions?.modelDimension
				if (
					prevOpenAiCompatibleBaseUrl !== currentOpenAiCompatibleBaseUrl ||
					prevOpenAiCompatibleApiKey !== currentOpenAiCompatibleApiKey ||
					prevOpenAiCompatibleModelDimension !== currentOpenAiCompatibleModelDimension
				) {
					return true
				}
			}

			// Qdrant configuration changes
			const currentQdrantUrl = this.qdrantUrl ?? ""
			const currentQdrantApiKey = this.qdrantApiKey ?? ""

			if (prevQdrantUrl !== currentQdrantUrl || prevQdrantApiKey !== currentQdrantApiKey) {
				return true
			}

			// Enhancement configuration changes
			const currentEmbeddingApiKey = this.embeddingOptions?.apiKey ?? ""
			const currentEmbeddingBaseUrl = this.embeddingOptions?.baseUrl ?? ""
			const currentEmbeddingModelID = this.embeddingOptions?.modelID ?? ""

			if (
				prevembeddingApiKey !== currentEmbeddingApiKey ||
				prevembeddingBaseUrl !== currentEmbeddingBaseUrl ||
				prevembeddingModelID !== currentEmbeddingModelID
			) {
				return true
			}

			// Enhancement configuration changes
			const currentEnhancementApiKey = this.enhancementOptions?.apiKey ?? ""
			const currentEnhancementBaseUrl = this.enhancementOptions?.baseUrl ?? ""
			const currentEnhancementModelID = this.enhancementOptions?.modelID ?? ""
			

			if (
				prevenhancementApiKey !== currentEnhancementApiKey ||
				prevenhancementBaseUrl !== currentEnhancementBaseUrl ||
				prevenhancementModelID !== currentEnhancementModelID
			) {
				return true
			}

			// Rerank configuration changes
			const currentRerankBaseUrl = this.rerankOptions?.baseUrl ?? ""
			const currentRerankApiKey = this.rerankOptions?.apiKey ?? ""
			const currentRerankModelID = this.rerankOptions?.modelID ?? ""

			if (
				prevrerankBaseUrl !== currentRerankBaseUrl ||
				prevrerankApiKey !== currentRerankApiKey ||
				prevrerankModelID !== currentRerankModelID
			) {
				return true
			}

			const currentRagPath = this.ragPath ?? ""
			if (
				prevragPath !== currentRagPath
			) {
				return true
			}

			const currentCodeBaseLogging = this.codeBaseLogging ?? false
			if (
				prevcodeBaseLogging !== currentCodeBaseLogging
			) {
				return true
			}
			
		}

		return false
	}

	/**
	 * Checks if model changes result in vector dimension changes that require restart.
	 */
	private _hasVectorDimensionChanged(prevProvider: EmbedderProvider, prevModelId?: string): boolean {
		const currentProvider = this.embedderProvider
		const currentModelId = this.modelId ?? getDefaultModelId(currentProvider)
		const resolvedPrevModelId = prevModelId ?? getDefaultModelId(prevProvider)

		// If model IDs are the same and provider is the same, no dimension change
		if (prevProvider === currentProvider && resolvedPrevModelId === currentModelId) {
			return false
		}

		// Get vector dimensions for both models
		const prevDimension = getModelDimension(prevProvider, resolvedPrevModelId)
		const currentDimension = getModelDimension(currentProvider, currentModelId)

		// If we can't determine dimensions, be safe and restart
		if (prevDimension === undefined || currentDimension === undefined) {
			return true
		}

		// Only restart if dimensions actually changed
		return prevDimension !== currentDimension
	}

	/**
	 * Gets the current configuration state.
	 */
	public getConfig(): CodeIndexConfig {
		return {
			isEnabled: this.isEnabled,
			isConfigured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			openAiOptions: this.openAiOptions,
			ollamaOptions: this.ollamaOptions,
			openAiCompatibleOptions: this.openAiCompatibleOptions,
			qdrantUrl: this.qdrantUrl,
			qdrantApiKey: this.qdrantApiKey,
			searchMinScore: this.searchMinScore,

			embeddingOptions: this.embeddingOptions,
			enhancementOptions: this.enhancementOptions,
			rerankOptions: this.rerankOptions,

			ragPath: this.ragPath,
			llmFilter: this.llmFilter,
			codeBaseLogging: this.codeBaseLogging,
		}
	}

	/**
	 * Gets whether the code indexing feature is enabled
	 */
	public get isFeatureEnabled(): boolean {
		return this.isEnabled
	}

	/**
	 * Gets whether the code indexing feature is properly configured
	 */
	public get isFeatureConfigured(): boolean {
		return this.isConfigured()
	}

	/**
	 * Gets the current embedder type (openai or ollama)
	 */
	public get currentEmbedderProvider(): EmbedderProvider {
		return this.embedderProvider
	}

	/**
	 * Gets the current Qdrant configuration
	 */
	public get qdrantConfig(): { url?: string; apiKey?: string } {
		return {
			url: this.qdrantUrl,
			apiKey: this.qdrantApiKey,
		}
	}

	/**
	 * Gets the current model ID being used for embeddings.
	 */
	public get currentModelId(): string | undefined {
		return this.modelId
	}

	/**
	 * Gets the configured minimum search score.
	 */
	public get currentSearchMinScore(): number | undefined {
		return this.searchMinScore
	}
}
