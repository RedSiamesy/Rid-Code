import { type ModelInfo } from "../model.js"

export type InfiniModelId = keyof typeof infiniModels

export const infiniDefaultModelId: InfiniModelId = "kimi-2.5"

export const infiniModels = {
	"kimi-2.5": {
		maxTokens: 16_384,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "Kimi 2.5 model on Infini.",
	},
	"minimax-m2.5": {
		maxTokens: 16_384,
		contextWindow: 192_000,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "MiniMax M2.5 model on Infini.",
	},
	"glm-4.7": {
		maxTokens: 131_072,
		contextWindow: 196_608,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "GLM-4.7 model on Infini.",
	},
	"glm-5": {
		maxTokens: 131_072,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "GLM-5 model on Infini.",
	},
} as const satisfies Record<string, ModelInfo>
