import type { ModelInfo } from "../model.js"

export type ModelScopeModelId = keyof typeof modelScopeModels

export const modelScopeDefaultModelId: ModelScopeModelId = "ZhipuAI/GLM-4.7"

export const modelScopeModels = {
	"ZhipuAI/GLM-4.7": {
		maxTokens: 131_072,
		contextWindow: 196_608,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.12,
		outputPrice: 0.28,
		description: "GLM-4.7 model from ZhipuAI.",
	},
	"moonshotai/Kimi-K2.5": {
		maxTokens: 16_384,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.12,
		outputPrice: 0.28,
		description: "Kimi-K2.5 model from Moonshot AI.",
	},
} as const satisfies Record<string, ModelInfo>
