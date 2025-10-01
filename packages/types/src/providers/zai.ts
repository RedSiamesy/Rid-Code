import type { ModelInfo } from "../model.js"

// Z AI
// https://docs.z.ai/guides/llm/glm-4.5
// https://docs.z.ai/guides/overview/pricing

export type InternationalZAiModelId = keyof typeof internationalZAiModels
export const internationalZAiDefaultModelId: InternationalZAiModelId = "glm-4.5"
export const internationalZAiModels = {
	"glm-4.6": {
		maxTokens: 98_304,
		contextWindow: 204_800,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.28,
		outputPrice: 1.12,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0.056,
		description:
			"GLM-4.6 is Zhipu's latest flagship model, featuring 355B total parameters and 32B active parameters, with context length extended to 200K. It achieves comprehensive improvements across 8 major authoritative benchmarks, securing its position as the leading Chinese-developed model. GLM-4.6 surpasses GLM-4.5 in core capabilities including programming, reasoning, search, writing, and agent applications.",
		tiers: [
			{
				contextWindow: 32_768,
				inputPrice: 0.28,
				outputPrice: 1.12,
				cacheReadsPrice: 0.056,
			},
			{
				contextWindow: 204_800,
				inputPrice: 0.56,
				outputPrice: 2.24,
				cacheReadsPrice: 0.112,
			}
		],
	},
	"glm-4.5": {
		maxTokens: 98_304,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.28,
		outputPrice: 1.12,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0.056,
		description:
			"GLM-4.5 is Zhipu's latest featured model. Its comprehensive capabilities in reasoning, coding, and agent reach the state-of-the-art (SOTA) level among open-source models, with a context length of up to 128k.",
		tiers: [
			{
				contextWindow: 32_768,
				inputPrice: 0.28,
				outputPrice: 1.12,
				cacheReadsPrice: 0.056,
			},
			{
				contextWindow: 131_072,
				inputPrice: 0.56,
				outputPrice: 2.24,
				cacheReadsPrice: 0.112,
			}
		],
	},
	"glm-4.5-air": {
		maxTokens: 98_304,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.1,
		outputPrice: 0.6,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0.02,
		description:
			"GLM-4.5-Air is the lightweight version of GLM-4.5. It balances performance and cost-effectiveness, and can flexibly switch to hybrid thinking models.",
		tiers: [
			{
				contextWindow: 32_768,
				inputPrice: 0.112,
				outputPrice: 0.28,
				cacheReadsPrice: 0.022,
			},
			{
				contextWindow: 131_072,
				inputPrice: 0.17,
				outputPrice: 1.12,
				cacheReadsPrice: 0.034,
			},
		],
	},
} as const satisfies Record<string, ModelInfo>

export type MainlandZAiModelId = keyof typeof mainlandZAiModels
export const mainlandZAiDefaultModelId: MainlandZAiModelId = "glm-4.5"
export const mainlandZAiModels = {
	"glm-4.6": {
		maxTokens: 98_304,
		contextWindow: 204_800,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.28,
		outputPrice: 1.12,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0.056,
		description:
			"GLM-4.6 is Zhipu's latest flagship model, featuring 355B total parameters and 32B active parameters, with context length extended to 200K. It achieves comprehensive improvements across 8 major authoritative benchmarks, securing its position as the leading Chinese-developed model. GLM-4.6 surpasses GLM-4.5 in core capabilities including programming, reasoning, search, writing, and agent applications.",
		tiers: [
			{
				contextWindow: 32_768,
				inputPrice: 0.28,
				outputPrice: 1.12,
				cacheReadsPrice: 0.056,
			},
			{
				contextWindow: 204_800,
				inputPrice: 0.56,
				outputPrice: 2.24,
				cacheReadsPrice: 0.112,
			}
		],
	},
	"glm-4.5": {
		maxTokens: 98_304,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.28,
		outputPrice: 1.12,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0.056,
		description:
			"GLM-4.5 is Zhipu's latest featured model. Its comprehensive capabilities in reasoning, coding, and agent reach the state-of-the-art (SOTA) level among open-source models, with a context length of up to 128k.",
		tiers: [
			{
				contextWindow: 32_768,
				inputPrice: 0.28,
				outputPrice: 1.12,
				cacheReadsPrice: 0.056,
			},
			{
				contextWindow: 131_072,
				inputPrice: 0.56,
				outputPrice: 2.24,
				cacheReadsPrice: 0.112,
			}
		],
	},
	"glm-4.5-air": {
		maxTokens: 98_304,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.1,
		outputPrice: 0.6,
		cacheWritesPrice: 0,
		cacheReadsPrice: 0.02,
		description:
			"GLM-4.5-Air is the lightweight version of GLM-4.5. It balances performance and cost-effectiveness, and can flexibly switch to hybrid thinking models.",
		tiers: [
			{
				contextWindow: 32_768,
				inputPrice: 0.112,
				outputPrice: 0.28,
				cacheReadsPrice: 0.022,
			},
			{
				contextWindow: 131_072,
				inputPrice: 0.17,
				outputPrice: 1.12,
				cacheReadsPrice: 0.034,
			},
		],
	},
} as const satisfies Record<string, ModelInfo>

export const ZAI_DEFAULT_TEMPERATURE = 0
