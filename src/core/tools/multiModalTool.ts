import { Task } from "../task/Task"
import { ApiHandler, buildApiHandler } from "../../api"
import { ApiMessage } from "../task-persistence/apiMessages"
import { getMessagesSinceLastSummary } from "../condense"
import { ApiStream } from "../../api/transform/stream"


async function performAnalysis(
	task: Task,
	apiHandler?: ApiHandler,
	feedback?: Anthropic.Messages.ContentBlockParam[],
	has_image: boolean = false
): Promise<ApiStream> {
	// 如果没有可用的 API handler，返回占位符消息
	if (!apiHandler) {
		throw new Error("没有可用的 API 配置来执行思考工具。请检查设置。")
	}

	try {
		const feedback_image = feedback?.filter(fb => fb.type === 'image') as Anthropic.Messages.ContentBlockParam[]
		const feedback_text = feedback?.filter(fb => fb.type !== 'image') as Anthropic.Messages.ContentBlockParam[]

		// 获取当前任务的上下文信息
		const agentContext = getMessagesSinceLastSummary(task.apiConversationHistory)

		let all_feedback:Anthropic.Messages.ContentBlockParam[] = []
		all_feedback.push({text: `当前用户提出了一个任务：${JSON.stringify(feedback_text)}\n\n请根据上述用户任务，描述所有图片中的所有内容，并对图片中与任务相关的内容进行详细的描述分析。**不要调用任何工具!!** **DO NOT USE TOOL_CALL!!**`, type: 'text' as const} as Anthropic.Messages.TextBlockParam)
		for (const img of feedback_image) {
			all_feedback.push(img)
		}

		const taskContext: ApiMessage[] = feedback_image ? [
			...agentContext,
			{ role: "user" as const, content: all_feedback }
		]:[]

		// 准备发送给 API 的完整消息
// 		const systemPrompt = `
// 你是一个专业的多模态内容分析师
// 用户输入了一段agent对话上下文和图片和一个新的任务，请根据上下问讨论的内容做出以下操作：

// ${!has_image?`# 工作

// 你需要判断用户的任务与多模态内容是否相关，根据不同的情况进行不同的回答：

// ## **当任务和多模态内容无关的情况** 或 **agent上下文中已经包含足够解决任务的多模态信息**

// 当*用户的任务*或*agent正在处理的任务*与*上下文中任何的多模态内容*无关，或agent上下文中已经包含足够解决任务的多模态信息时，你必须识别出这样的场景，并且只回答\`N\`一个字符，不要回答任何别的内容。

// 例如，如果用户已经通过多模态分析工具（multi_modal_analysis_content），描述过多模态内容细节，且有**足够的信息正确地**回答当前问题，则直接回答\`N\`

// ## **当任务和多模态内容有关的情况**

// 当*用户的任务*或*agent正在处理的任务*与*上下文中任何的多模态内容*有关时，你需要回答以下内容`:"你需要根据多模态信息和用户任务回答以下内容"}

// 其中需要包括: 
// 1. 对相关多模态内容的完整内容的精确描述
// 2. 对相关多模态内容中的重要部分进行精确描述（如果相关内容用户已经还原过（相关内容可能在用户消息多模态内容分析（multi_modal_analysis_content）中），则**不要再次还原**。如果用户**没有**还原过多模态相关内容，且内容可以被markdown或mermaid格式还原，则尽可能还原内容。例如：如果用户已经通过多模态分析，还原过相关细节，则当前描述中不要再次还原）
// 3. 根据agent上下文和当前用户任务，对图片中相关联的内容进行详细分析
// 4. 结合所有内容，对当前用户任务进行作答

// 重点：
// 0. 你的目标不是解决agent正在处理的问题，应该专注于多模态内容本身
// 1. 如果多模态内容包含文本段落，你需要对每个部分的所有文本进行ocr识别
// 2. 如果多模态内容包含图表、流程图等内容，你需要用markdown进行还原（不是在代码块中，而是直接输出）
// 3. 如果多模态内容包含流程图等内容，你需要用mermaid格式在\`\`\` mermaid \`\`\`代码块中进行还原

// **注意：你没有工具调用的能力，不要调用任何工具！！**
// **注意：如果上下文中已经包含你想输出的描述或分析，禁止重复输出！！**
// **注意：提高你回答的信息密度，在还原多模态内容的前提下，简洁而精确地进行分析和描述，不要重复相同内容，不要说任何语气词和废话！！**
// **注意：如果用户说"看下图" "仔细看下图" 之类的话，则需要进行分析，不要直接返回\`N\`！！**
// `
	const systemPrompt = `
You are a professional multimodal content analyst.
The user inputs a segment of agent conversation context, an image, and a new task. Please perform the following operations based on the discussion in the context:

${!has_image?`# Job

You need to determine whether the user's task is relevant to the multimodal content and respond differently based on different situations:

## **When the task is irrelevant to multimodal content** or **the agent context already contains sufficient multimodal information to solve the task**

When *the user's task* or *the task the agent is processing* is irrelevant to *any multimodal content in the context*, or the agent context already contains sufficient multimodal information to solve the task, you must identify such scenarios and answer only with the single character \`N\`. Do not answer with anything else.

For example, if the user has already described multimodal content details via the multimodal analysis tool (multi_modal_analysis_content) and there is **sufficient information to correctly** answer the current question, answer \`N\` directly.

## **When the task is relevant to multimodal content**

When *the user's task* or *the task the agent is processing* is relevant to *any multimodal content in the context*, you need to answer the following content`:"You need to answer the following content based on the multimodal information and the user's task"}

It must include:
1. A precise description of the full content of the relevant multimodal content.
2. A precise description of the important parts of the relevant multimodal content (If multimodal information has not been described in detail in the context, it needs to be described in detail) ${!has_image?"(If the user has already reconstructed the relevant content (which might be in the user message multi_modal_analysis_content), **do not reconstruct it again**. If the user has **not** reconstructed the relevant multimodal content, and the content can be reconstructed in Markdown or Mermaid format, reconstruct it as much as possible.":"(If the user has **not** reconstructed the relevant multimodal content, and the content can be reconstructed in Markdown or Mermaid format, reconstruct it as much as possible. If the user has already reconstructed the relevant content (which might be in the user message multi_modal_analysis_content), **do not reconstruct it again**."} For example: if the user has already reconstructed relevant details via multimodal analysis, do not reconstruct them again in the current description).
3. A precise analysis of the associated content in the image based on the agent context and the current user task.
4. Combine all content to answer the current user task.

Key Points:
0. Your goal is not to solve the problem the agent is processing; you should focus on the multimodal content itself.
1. If the multimodal content contains text paragraphs, you need to perform OCR recognition on all text in every part.
2. If the multimodal content contains charts, flowcharts, etc., you need to reconstruct them using Markdown (not inside a code block, but output directly).
3. If the multimodal content contains flowcharts, etc., you need to reconstruct them in Mermaid format within a \`\`\` mermaid \`\`\` code block.

**Note: You do not have the ability to call tools; do not call any tools!! DO NOT USE TOOL_CALL!!**
**Note: If the context already contains the description or analysis you want to output, do not output it again!!**
**Note: Increase the information density of your response. While reconstructing multimodal content, analyze and describe concisely and precisely. DO NOT REPEAT the same content, and DO NOT use any filler words or nonsense!!**
**Note: If the user says phrases like "看下图", "仔细看下图", "Look at the image below" or "Look carefully at the image below", you need to perform the analysis and must not directly return \`N\`!!**
`
		// 调用 API 进行分析
		const stream = apiHandler.createMessage(
			systemPrompt,
			taskContext
		)

		return stream

	} catch (error) {
		throw new Error("思考工具分析失败: " + (error instanceof Error ? error.message : String(error)))
	}
}


import { Anthropic } from "@anthropic-ai/sdk"

export async function userExecuteMultiModalThinking(
	task: Task,
	feedback: Anthropic.Messages.ContentBlockParam[],
	has_image: boolean = false,
): Promise<string | undefined> {
	try {
		// 获取 thinking tool 配置并构建 API handler
		const state = await task.providerRef.deref()?.getState()
		const multiModalToolApiConfigId = state?.multiModalToolApiConfigId
		const listApiConfigMeta = state?.listApiConfigMeta

		// 确定要使用的 API handler
		let multiModalApiHandler: ApiHandler | undefined
		if (multiModalToolApiConfigId && multiModalToolApiConfigId !== "default" && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
			// 通过 ID 查找匹配的配置（仅在不是default时）
			const matchingConfig = listApiConfigMeta.find((config) => config.id === multiModalToolApiConfigId)
			if (matchingConfig) {
				const profile = await task.providerRef.deref()?.providerSettingsManager.getProfile({
					id: multiModalToolApiConfigId,
				})
				// 确保_profile 和 apiProvider 存在再尝试构建 handler
				if (profile && profile.apiProvider) {
					multiModalApiHandler = buildApiHandler(profile)
				}
			}
		}

		// 如果没有配置专门的 thinking API handler（包括选择了default），使用主要的 API handler 作为后备
		const apiHandlerToUse = multiModalApiHandler || task.api

		console.log(`apiHandlerToUse.getModel().info.supportsImages: ${apiHandlerToUse.getModel().info.supportsImages}`)
		if (apiHandlerToUse.getModel().info.supportsImages !== true) {
			return undefined
		}

		const stream = await performAnalysis(task, apiHandlerToUse, feedback, has_image)
		let analysisResult = ""
		let analysisreasoning = "<multi_modal_analysis>\n\n"
		for await (const chunk of stream) {
			if (chunk.type === "text") {
				analysisreasoning += chunk.text
				analysisResult += chunk.text
				if (analysisreasoning.length > 26+16) {
					await task.say("reasoning", analysisreasoning, undefined, true)
				}
			}
		}
		
			analysisreasoning += "\n\n</multi_modal_analysis>\n\n"
		
		if (analysisreasoning.length > 57+16) {
			await task.say("reasoning", analysisreasoning, undefined, true)
		}
		if (analysisResult.length > 16) {
			return "Multi modal analysis tool respond:\n" + analysisResult
		} else {
			return undefined
		}
	} catch (error) {
		console.log(`error: ${error}`)
		return undefined
	}
}