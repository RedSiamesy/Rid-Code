import type { ModelInfo } from "../model.js"

export type SiliconFlowModelId = keyof typeof siliconFlowModels

export const siliconFlowDefaultModelId: SiliconFlowModelId = "deepseek-ai/DeepSeek-V3.2"

export const siliconFlowModels = {
	"deepseek-ai/DeepSeek-V3.2": {
		maxTokens: 8_192,
		contextWindow: 160_000,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningEffort: true,
		inputPrice: 0.2857, // ¥2/M Tokens in USD (approx)
		outputPrice: 0.4286, // ¥3/M Tokens in USD (approx)
		description: `DeepSeek-V3.2 是一款兼具高计算效率与卓越推理和 Agent 性能的模型。其方法建立在三大关键技术突破之上：DeepSeek 稀疏注意力（DSA），一种高效的注意力机制；可扩展的强化学习框架；以及大规模 Agent 任务合成管线。该模型在 2025 年国际数学奥林匹克（IMO）和国际信息学奥林匹克（IOI）中取得了金牌表现。支持工具调用和前缀续写。`,
	},
	"deepseek-ai/DeepSeek-V3.1-Terminus": {
		maxTokens: 8_192,
		contextWindow: 160_000,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningEffort: true,
		inputPrice: 0.5714, // ¥4/M Tokens in USD (approx)
		outputPrice: 1.7143, // ¥12/M Tokens in USD (approx)
		description: `DeepSeek-V3.1-Terminus 是深度求索发布的 V3.1 模型的更新版本，定位为混合智能体大语言模型。此次更新专注于修复用户反馈的问题并提升稳定性，显著改善了语言一致性，减少了中英文混用和异常字符的出现。集成了"思考模式"和"非思考模式"，增强了代码智能体和搜索智能体的性能。支持工具调用和前缀续写。`,
	},
	"moonshotai/Kimi-K2-Thinking": {
		maxTokens: 8_192,
		contextWindow: 256_000,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningEffort: true,
		inputPrice: 0.5714, // ¥4/M Tokens in USD (approx)
		outputPrice: 2.2857, // ¥16/M Tokens in USD (approx)
		description: `Kimi K2 Thinking 是最新、最强大的开源思考模型。它通过大幅扩展多步推理深度，并在 200-300 次连续工具调用中保持稳定的工具使用，在 Humanity's Last Exam (HLE)、BrowseComp 及其他基准测试中树立了新的标杆。同时，K2 Thinking 是一款原生支持 INT4 量化的模型，拥有 256K 上下文窗口，实现了推理延迟和 GPU 显存占用的无损降低。支持工具调用和前缀续写。`,
	},
	"MiniMaxAI/MiniMax-M2": {
		maxTokens: 8_192,
		contextWindow: 200_000,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningEffort: true,
		inputPrice: 0.3, // ¥2.1/M Tokens in USD (approx)
		outputPrice: 1.2, // ¥8.4/M Tokens in USD (approx)
		description: `MiniMax-M2 为智能体重新定义了效率。它是一款紧凑、快速且经济高效的 MoE 模型，拥有 2300 亿总参数和 100 亿激活参数，专为编码和智能体任务的顶级性能而打造。仅需 100 亿激活参数，MiniMax-M2 就能提供当今领先模型所期望的复杂端到端工具使用性能。支持工具调用和前缀续写。`,
	},
	"zai-org/GLM-4.6": {
		maxTokens: 8_192,
		contextWindow: 200_000,
		supportsImages: false,
		supportsPromptCache: false,
		supportsReasoningEffort: true,
		inputPrice: 0.5, // ¥3.5/M Tokens in USD (approx)
		outputPrice: 2.0, // ¥14/M Tokens in USD (approx)
		description: `GLM-4.6 带来了多项关键改进。其上下文窗口从 128K 扩展到 200K tokens，使模型能够处理更复杂的智能体任务。模型在代码基准测试中取得了更高的分数，并在 Claude Code、Cline、Roo Code 和 Kilo Code 等应用中展现了更强的真实世界性能。GLM-4.6 在推理性能上表现出明显提升，并支持在推理过程中使用工具。支持工具调用和前缀续写。`,
	},
	"Qwen/Qwen3-VL-235B-A22B-Instruct": {
		maxTokens: 8_192,
		contextWindow: 256_000,
		supportsImages: true,
		supportsPromptCache: false,
		supportsReasoningEffort: false,
		inputPrice: 0.3571, // ¥2.5/M Tokens in USD (approx)
		outputPrice: 1.4286, // ¥10/M Tokens in USD (approx)
		description: `Qwen3-VL-235B-A22B-Instruct 是一个拥有 2350 亿参数的混合专家（MoE）视觉语言模型，其中激活的参数量为 220 亿。它是 Qwen3-VL-235B-A22B 的指令微调版本，专为聊天应用进行了优化。Qwen3-VL 是一系列接受文本和图像输入的多模态模型。支持视觉输入、工具调用、前缀续写、FIM补全和多语言处理。`,
	},
	"deepseek-ai/DeepSeek-OCR": {
		maxTokens: 8_192,
		contextWindow: 8_000,
		supportsImages: true,
		supportsPromptCache: false,
		supportsReasoningEffort: false,
		inputPrice: 0, // 免费
		outputPrice: 0, // 免费
		description: `DeepSeek-OCR 是由深度求索（DeepSeek AI）推出的一个视觉语言模型，专注于光学字符识别（OCR）与"上下文光学压缩"。该模型旨在探索从图像中压缩上下文信息的边界，能够高效处理文档并将其转换为如 Markdown 等结构化文本格式。支持视觉输入和OCR功能。`,
	},
} as const satisfies Record<string, ModelInfo>

export const SILICON_FLOW_DEFAULT_TEMPERATURE = 0
