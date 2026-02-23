import { type ModelInfo } from "../model.js"

export type QianfanModelId = keyof typeof qianfanModels

export const qianfanDefaultModelId: QianfanModelId = "qianfan-code-latest"

export const qianfanModels = {
	"qianfan-code-latest": {
		maxTokens: 131_072,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		supportsNativeTools: true,
		defaultToolProtocol: "native",
		description: "Qianfan Code Latest with 256k context window and 128k max output tokens.",
	},
} as const satisfies Record<string, ModelInfo>
