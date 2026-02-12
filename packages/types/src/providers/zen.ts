import type { ModelInfo } from "../model.js"

export type ZenModelId = keyof typeof zenModels

export const zenDefaultModelId: ZenModelId = "kimi-k2.5-free"

export const zenModels = {
	"kimi-k2.5-free": {
		maxTokens: 16_384,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0,
		outputPrice: 0,
		description: "Free Kimi K2.5 model with 256k context and image support.",
	},
	"kimi-k2.5": {
		maxTokens: 16_384,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.6,
		outputPrice: 3.0,
		cacheReadsPrice: 0.08,
		description: "Kimi K2.5 model with 256k context and image support.",
	},
	"glm-4.7-free": {
		maxTokens: 16_384,
		contextWindow: 204_800,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0,
		outputPrice: 0,
		description: "Free GLM-4.7 model with 200k context.",
	},
	"glm-4.7": {
		maxTokens: 16_384,
		contextWindow: 204_800,
		supportsImages: false,
		supportsPromptCache: true,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.6,
		outputPrice: 2.2,
		cacheReadsPrice: 0.1,
		description: "GLM-4.7 model with 200k context.",
	},
} as const satisfies Record<string, ModelInfo>
