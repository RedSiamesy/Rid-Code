import type { ModelInfo } from "../model.js"

export type AiCoderModelId = keyof typeof aiCoderModels

export const aiCoderDefaultModelId: AiCoderModelId = "gpt-5.2"

export const aiCoderModels = {
	"gpt-5.2": {
		maxTokens: 65_536,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		supportsReasoningEffort: false,
		cacheReadsPrice: 0.175,
		inputPrice: 1.75,
		outputPrice: 14.0,
		description: "Base model for everyday coding tasks and problem solving.",
	},
	"gpt-5.2:thinking": {
		maxTokens: 65_536,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		supportsReasoningEffort: true,
		cacheReadsPrice: 0.175,
		inputPrice: 1.75,
		outputPrice: 14.0,
		description: "Base model with reasoning effort support for deeper analysis.",
	},
	"gpt-5.1": {
		maxTokens: 65_536,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		supportsReasoningEffort: false,
		cacheReadsPrice: 0.125,
		inputPrice: 1.25,
		outputPrice: 10.0,
		description: "Balanced model for general coding tasks.",
	},
	"gpt-5.1:thinking": {
		maxTokens: 65_536,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		supportsReasoningEffort: true,
		cacheReadsPrice: 0.125,
		inputPrice: 1.25,
		outputPrice: 10.0,
		description: "Balanced model with reasoning effort support.",
	},
} as const satisfies Record<string, ModelInfo>

export const AICODER_DEFAULT_TEMPERATURE = 0
