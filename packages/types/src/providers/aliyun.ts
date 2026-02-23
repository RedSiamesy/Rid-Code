import { type ModelInfo } from "../model.js"

export type AliyunModelId = keyof typeof aliyunModels

export const aliyunDefaultModelId: AliyunModelId = "qwen3.5-plus"

export const aliyunModels = {
	"qwen3.5-plus": {
		maxTokens: 131_072,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "Qwen 3.5 Plus model on Aliyun.",
	},
	"qwen3-max-2026-01-23": {
		maxTokens: 131_072,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "Qwen 3 Max (2026-01-23) model on Aliyun.",
	},
	"qwen3-coder-next": {
		maxTokens: 131_072,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "Qwen 3 Coder Next model on Aliyun.",
	},
	"qwen3-coder-plus": {
		maxTokens: 131_072,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "Qwen 3 Coder Plus model on Aliyun.",
	},
	"glm-4.7": {
		maxTokens: 131_072,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "GLM-4.7 model on Aliyun.",
	},
	"kimi-k2.5": {
		maxTokens: 131_072,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "Kimi K2.5 model on Aliyun.",
	},
	"glm-5": {
		maxTokens: 131_072,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "GLM-5 model on Aliyun.",
	},
} as const satisfies Record<string, ModelInfo>
