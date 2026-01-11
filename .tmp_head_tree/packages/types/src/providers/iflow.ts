import type { ModelInfo } from "../model.js"

export type IFlowModelId = keyof typeof iFlowModels

export const iFlowDefaultModelId: IFlowModelId = "glm-4.6"

export const iFlowModels = {
	"glm-4.7": {
		maxTokens: 131_072,
		contextWindow: 196_608,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.12,
		outputPrice: 0.28,
		description: "GLM-4.7 flagship model with stronger coding and multi-step reasoning.",
	},
	"glm-4.6": {
		maxTokens: 65_536,
		contextWindow: 196_608,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 0.12,
		outputPrice: 0.28,
		description: "GLM-4.6 model tuned for general development and reasoning tasks.",
	},
	"qwen3-coder-plus": {
		maxTokens: 65_536,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 1.2,
		outputPrice: 3.6,
		description: "Qwen3 Coder Plus model optimized for agentic coding workflows.",
	},
	"qwen3-vl-plus": {
		maxTokens: 32_768,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 1.2,
		outputPrice: 3.6,
		description: "Qwen3 VL Plus vision-language model for multimodal reasoning.",
	},
	"qwen3-max": {
		maxTokens: 32_768,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		inputPrice: 1.2,
		outputPrice: 3.6,
		description: "Qwen3 Max model focused on agentic tool use and coding.",
	},
} as const satisfies Record<string, ModelInfo>
