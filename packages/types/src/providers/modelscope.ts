import type { ModelInfo } from "../model.js"

// https://platform.deepseek.com/docs/api
export type ModelScopeModelId = keyof typeof modelScopeModels

export const modelScopeDefaultModelId: ModelScopeModelId = "Qwen/Qwen3-Coder-480B-A35B-Instruct"

export const modelScopeModels = {
	"Qwen/Qwen3-Coder-480B-A35B-Instruct": {
		maxTokens: 65_536,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 3, 
		outputPrice: 15, 
		description: `Qwen3-Coder-480B-A35B-Instruct is a Mixture-of-Experts (MoE) code generation model developed by the Qwen team. It is optimized for agentic coding tasks such as function calling, tool use, and long-context reasoning over repositories. The model features 480 billion total parameters, with 35 billion active per forward pass (8 out of 160 experts).`,
		tiers: [
			{
				contextWindow: 32_768,
				inputPrice: 1,
				outputPrice: 5,
			},
			{
				contextWindow: 65_536,
				inputPrice: 1.8,
				outputPrice: 9,
			},
			{
				contextWindow: Infinity,
				inputPrice: 3,
				outputPrice: 15,
			},
		],
	},
	"Qwen/Qwen3-235B-A22B-Instruct-2507": {
		maxTokens: 32_768,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.7, 
		outputPrice: 2.8, 
		description: `Qwen3-235B-A22B-Instruct-2507 is a multilingual, instruction-tuned mixture-of-experts language model based on the Qwen3-235B architecture, with 22B active parameters per forward pass. It is optimized for general-purpose text generation, including instruction following, logical reasoning, math, code, and tool usage. The model supports a native 262K context length and does not implement "thinking mode" (<think> blocks). Compared to its base variant, this version delivers significant gains in knowledge coverage, long-context reasoning, coding benchmarks, and alignment with open-ended tasks. It is particularly strong on multilingual understanding, math reasoning (e.g., AIME, HMMT), and alignment evaluations like Arena-Hard and WritingBench.`,
	},
	"Qwen/Qwen3-235B-A22B-Thinking-2507": {
		maxTokens: 32_768,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.7, 
		outputPrice: 8.40, 
		description: `Qwen3-235B-A22B-Thinking-2507 is a high-performance, open-weight Mixture-of-Experts (MoE) language model optimized for complex reasoning tasks. It activates 22B of its 235B parameters per forward pass and natively supports up to 262,144 tokens of context. This "thinking-only" variant enhances structured logical reasoning, mathematics, science, and long-form generation, showing strong benchmark performance across AIME, SuperGPQA, LiveCodeBench, and MMLU-Redux. It enforces a special reasoning mode (</think>) and is designed for high-token outputs (up to 81,920 tokens) in challenging domains. The model is instruction-tuned and excels at step-by-step reasoning, tool use, agentic workflows, and multilingual tasks. This release represents the most capable open-source variant in the Qwen3-235B series, surpassing many closed models in structured reasoning use cases.`,
	},
} as const satisfies Record<string, ModelInfo>

export const MODEL_SCOPE_DEFAULT_TEMPERATURE = 0
