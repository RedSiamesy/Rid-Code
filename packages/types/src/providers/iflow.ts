import type { ModelInfo } from "../model.js"

export type IFlowModelId = keyof typeof iFlowModels

export const iFlowDefaultModelId: IFlowModelId = "deepseek-v3.1"

export const iFlowModels = {
	"deepseek-v3.1": {
		maxTokens: 65_536,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.56,
		outputPrice: 1.68,
		description: "DeepSeek-V3.1-Terminus包含了混合推理架构、更高的思考效率、更强的Agent能力。混合推理架构：一个模型同时支持思考模式与非思考模式； 更高的思考效率：相比DeepSeek-R1-0528，DeepSeek-V3.1-Think能在更短时间内给出答案； 更强的Agent能力：通过Post-Training优化，新模型在工具使用与智能体任务中的表现有较大提升。",
	},
	"deepseek-v3.2": {
		maxTokens: 32_768,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.28,
		outputPrice: 0.42,
		description: "DeepSeek-V3.2-Exp 模型，这是一个实验性（Experimental）的版本。作为迈向新一代架构的中间步骤，V3.2-Exp 在 V3.1-Terminus 的基础上引入了 DeepSeek Sparse Attention（一种稀疏注意力机制），针对长文本的训练和推理效率进行了探索性的优化和验证",
	},
	"deepseek-r1": {
		maxTokens: 65_536,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.55,
		outputPrice: 2.19,
		description: "DeepSeek-R1，是深度求索研发的推理模型。DeepSeek-R1采用强化学习进行后训练，旨在提升推理能力，尤其擅长数学、代码和自然语言推理等复杂任务",
	},
	"glm-4.5": {
		maxTokens: 65_536,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.12,
		outputPrice: 0.28,
		description: "GLM-4.5 是基于智谱新一代旗舰文本模型 GLM-4.5-Air 开发的，延续了 GLM-4.1V-Thinking 的技术路线，在 41 个公开视觉多模态任务中取得了同级别开源模型中的最佳表现，覆盖图像、视频、文档理解以及 GUI Agent 等多种典型应用场景。",
	},
	"kimi-k2-0905": {
		maxTokens: 65_536,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 2.5,
		description: "Kimi K2-Instruct-0905，由月之暗面研发的开源万亿参数MoE模型。激活参数达320亿，采用混合专家架构，支持256K超长上下文，具备卓越的编码智能与工具调用能力，尤其在前端开发与多语言编程任务中表现突出。",
	},
	"qwen3-coder": {
		maxTokens: 65_536,
		contextWindow: 262_144,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.2,
		outputPrice: 3.6,
		description: "Qwen3-Coder-480B-A35B，这是一个总参数量 480B，激活 35B 的 MoE 模型，原生支持 256K token 的上下文并可通过 YaRN 扩展到 1M token，拥有卓越的代码和 Agent 能力。Qwen3-Coder-480B-A35B-Instruct 在 Agentic Coding、Agentic Browser-Use 和 Agentic Tool-Use 上取得了开源模型的 SOTA 效果，可以与 Claude Sonnet4 媲美",
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