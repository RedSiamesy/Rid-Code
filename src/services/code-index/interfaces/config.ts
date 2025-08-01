import { ApiHandlerOptions } from "../../../shared/api" // Adjust path if needed
import { EmbedderProvider } from "./manager"

/**
 * Configuration state for the code indexing feature
 */
export interface CodeIndexConfig {
	isConfigured: boolean
	embedderProvider: EmbedderProvider
	modelId?: string
	modelDimension?: number // Generic dimension property for all providers
	openAiOptions?: ApiHandlerOptions
	ollamaOptions?: ApiHandlerOptions
	openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
	geminiOptions?: { apiKey: string }
	qdrantUrl?: string
	qdrantApiKey?: string
	searchMinScore?: number
	searchMaxResults?: number

	embeddingOptions?: { baseUrl: string; apiKey: string; modelID: string }
	enhancementOptions?: { baseUrl: string; apiKey: string; modelID: string }

	ragPath?: string
	llmFilter?: boolean
	codeBaseLogging?: boolean
}

/**
 * Snapshot of previous configuration used to determine if a restart is required
 */
export type PreviousConfigSnapshot = {
	enabled: boolean
	configured: boolean
	embedderProvider: EmbedderProvider
	modelId?: string
	modelDimension?: number // Generic dimension property
	openAiKey?: string
	ollamaBaseUrl?: string
	openAiCompatibleBaseUrl?: string
	openAiCompatibleApiKey?: string
	geminiApiKey?: string
	qdrantUrl?: string
	qdrantApiKey?: string

	embeddingBaseUrl?: string
	embeddingApiKey?: string
	embeddingModelID?: string

	enhancementBaseUrl?: string
	enhancementApiKey?: string
	enhancementModelID?: string

	ragPath?: string
	llmFilter?: boolean
	codeBaseLogging?: boolean
}
