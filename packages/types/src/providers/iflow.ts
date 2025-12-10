import type { ModelInfo } from "../model.js"

export type IFlowModelId = keyof typeof iFlowModels

export const iFlowDefaultModelId: IFlowModelId = "glm-4.6"

export const iFlowModels = {
	"glm-4.6": {
		maxTokens: 65_536,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.12,
		outputPrice: 0.28,
		description: "支持thinking，GLM-4.6 是基于智谱新一代旗舰文本模型开发的，在 41 个公开视觉多模态任务中取得了同级别开源模型中的最佳表现，覆盖图像、视频、文档理解以及 GUI Agent 等多种典型应用场景。",
	},
	"qwen3-coder-plus": {
		maxTokens: 65_536,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.2,
		outputPrice: 3.6,
		description: "Qwen3-Coder-Plus，这是一个总参数量 480B，激活 35B 的 MoE 模型，原生支持 256K token 的上下文并可通过 YaRN 扩展到 1M token，拥有卓越的代码和 Agent 能力。Qwen3-Coder-480B-A35B-Instruct 在 Agentic Coding、Agentic Browser-Use 和 Agentic Tool-Use 上取得了开源模型的 SOTA 效果，可以与 Claude Sonnet4 媲美",
	},
	"qwen3-vl-plus": {
		maxTokens: 32_768,
		contextWindow: 262_144,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 1.2,
		outputPrice: 3.6,
		description: "Qwen3-VL 系列——这是迄今为止 Qwen 系列中最强大的视觉语言模型。 这一代模型在多个维度实现了全面跃升：无论是纯文本理解与生成，还是视觉内容的感知与推理；无论是上下文长度的支持能力，还是对空间关系、动态视频的理解深度；乃至在与Agent交互中的表现，Qwen3-VL 都展现出显著进步。",
	},
	"qwen3-max": {
		maxTokens: 32_768,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.2,
		outputPrice: 3.6,
		description: "通义千问3系列Max模型，相较preview版本在智能体编程与工具调用方向进行了专项升级。本次发布的正式版模型达到领域SOTA水平，适配场景更加复杂的智能体需求。",
	},
} as const satisfies Record<string, ModelInfo>