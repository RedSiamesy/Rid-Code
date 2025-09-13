import * as path from "path"
import fs from "fs/promises"
import pWaitFor from "p-wait-for"
import * as vscode from "vscode"
import Anthropic from "@anthropic-ai/sdk"

import { type Language, type ProviderSettings, type GlobalState, TelemetryEventName } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"
import { TelemetryService } from "@roo-code/telemetry"

import { ClineProvider } from "./ClineProvider"
import { changeLanguage, t } from "../../i18n"
import { Package } from "../../shared/package"
import { RouterName, toRouterName, ModelRecord } from "../../shared/api"
import { supportPrompt } from "../../shared/support-prompt"

import { checkoutDiffPayloadSchema, checkoutRestorePayloadSchema, WebviewMessage } from "../../shared/WebviewMessage"
import { checkExistKey } from "../../shared/checkExistApiConfig"
import { experimentDefault } from "../../shared/experiments"
import { Terminal } from "../../integrations/terminal/Terminal"
import { openFile } from "../../integrations/misc/open-file"
import { openImage, saveImage } from "../../integrations/misc/image-handler"
import { selectImages } from "../../integrations/misc/process-images"
import { getTheme } from "../../integrations/theme/getTheme"
import { discoverChromeHostUrl, tryChromeHostUrl } from "../../services/browser/browserDiscovery"
import { searchWorkspaceFiles } from "../../services/search/file-search"
import { fileExistsAtPath } from "../../utils/fs"
import { playTts, setTtsEnabled, setTtsSpeed, stopTts } from "../../utils/tts"
import { singleCompletionHandler } from "../../utils/single-completion-handler"
import { searchCommits } from "../../utils/git"
import { exportSettings, importSettings } from "../config/importExport"
import { getOpenAiModels } from "../../api/providers/openai"
import { getVsCodeLmModels } from "../../api/providers/vscode-lm"
import { openMention } from "../mentions"
import { TelemetrySetting } from "../../shared/TelemetrySetting"
import { getWorkspacePath } from "../../utils/path"
import { Mode, defaultModeSlug } from "../../shared/modes"
import { getModels, flushModels } from "../../api/providers/fetchers/modelCache"
import { GetModelsOptions } from "../../shared/api"
import { generateSystemPrompt } from "./generateSystemPrompt"
import { getCommand } from "../../utils/commands"
import { memoryUsage } from "process"
import { buildApiHandler } from "../../api"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"
import { getMessagesSinceLastSummary } from "../condense"

import {
	type ContextCondense,
} from "@roo-code/types"

interface MemoryFiles {
	globalMemoryPath: string
	projectMemoryPath: string
}

interface MemoryData {
	globalMemories: string[]
	projectMemories: string[]
}

interface MemoryOperations {
	addGlobal: string[]
	addProject: string[]
	deleteGlobal: string[]
	deleteProject: string[]
}

/**
 * 获取记忆文件路径
 */
async function getMemoryFilePaths(provider: ClineProvider): Promise<MemoryFiles> {
	const globalStoragePath = provider.context.globalStorageUri.fsPath
	const globalMemoryPath = path.join(globalStoragePath, "global-memory.md")
	
	const workspacePath = getWorkspacePath()
	if (!workspacePath) {
		throw new Error("无法获取工作区路径")
	}
	
	const projectMemoryDir = path.join(workspacePath, ".roo")
	const projectMemoryPath = path.join(projectMemoryDir, "project-memory.md")
	
	return {
		globalMemoryPath,
		projectMemoryPath
	}
}

/**
 * 读取记忆文件内容
 */
async function readMemoryFiles(memoryFiles: MemoryFiles): Promise<MemoryData> {
	const globalMemories: string[] = []
	const projectMemories: string[] = []
	
	// 读取全局记忆
	if (await fileExistsAtPath(memoryFiles.globalMemoryPath)) {
		try {
			const content = await fs.readFile(memoryFiles.globalMemoryPath, "utf-8")
			const lines = content.split('\n').filter(line => line.trim())
			globalMemories.push(...lines)
		} catch (error) {
			console.log("无法读取全局记忆文件:", error)
		}
	}
	
	// 读取项目记忆
	if (await fileExistsAtPath(memoryFiles.projectMemoryPath)) {
		try {
			const content = await fs.readFile(memoryFiles.projectMemoryPath, "utf-8")
			const lines = content.split('\n').filter(line => line.trim())
			projectMemories.push(...lines)
		} catch (error) {
			console.log("无法读取项目记忆文件:", error)
		}
	}
	
	return {
		globalMemories,
		projectMemories
	}
}

/**
 * 格式化历史记忆为AI输入格式
 */
function formatHistoryMemories(memoryData: MemoryData): string {
	if (memoryData.globalMemories.length === 0 && memoryData.projectMemories.length === 0) {
		return ""
	}
	
	let formatted = "<AgentHistoryMemory>\n"
	
	if (memoryData.globalMemories.length > 0) {
		formatted += "<GlobalMemory>\n"
		memoryData.globalMemories.forEach((memory, index) => {
			formatted += `${memory}\n`
		})
		formatted += "</GlobalMemory>\n\n"
	}
	
	if (memoryData.projectMemories.length > 0) {
		formatted += "<ProjectMemory>\n"
		memoryData.projectMemories.forEach((memory, index) => {
			formatted += `${memory}\n`
		})
		formatted += "</ProjectMemory>\n"
	}
	
	formatted += "</AgentHistoryMemory>"
	
	return formatted
}

/**
 * 解析AI返回的记忆操作指令
 */
function parseMemoryOperations(aiResponse: string): MemoryOperations {
	const lines = aiResponse.split('\n').filter(line => line.trim())
	
	const operations: MemoryOperations = {
		addGlobal: [],
		addProject: [],
		deleteGlobal: [],
		deleteProject: []
	}
	
	for (const line of lines) {
		const trimmedLine = line.trim()
		
		if (trimmedLine.startsWith("+ ")) {
			// 添加全局记忆
			operations.addGlobal.push(trimmedLine.substring(2).trim())
		} else if (trimmedLine.startsWith("++ ")) {
			// 添加项目记忆
			operations.addProject.push(trimmedLine.substring(3).trim())
		} else if (trimmedLine.startsWith("- ")) {
			// 删除全局记忆
			operations.deleteGlobal.push(trimmedLine.substring(2).trim())
		} else if (trimmedLine.startsWith("-- ")) {
			// 删除项目记忆
			operations.deleteProject.push(trimmedLine.substring(3).trim())
		}
	}
	
	return operations
}

/**
 * 生成操作详情的自然语言描述
 */
function generateOperationSummary(operations: MemoryOperations): string {
	const summaryParts: string[] = []
	
	// 全局记忆操作
	if (operations.addGlobal.length > 0) {
		summaryParts.push(`新增 ${operations.addGlobal.length} 条全局记忆`)
	}
	
	if (operations.deleteGlobal.length > 0) {
		summaryParts.push(`删除 ${operations.deleteGlobal.length} 条全局记忆`)
	}
	
	// 项目记忆操作
	if (operations.addProject.length > 0) {
		summaryParts.push(`新增 ${operations.addProject.length} 条项目记忆`)
	}
	
	if (operations.deleteProject.length > 0) {
		summaryParts.push(`删除 ${operations.deleteProject.length} 条项目记忆`)
	}
	
	if (summaryParts.length === 0) {
		return "无记忆变更"
	}
	
	return summaryParts.join("，")
}

/**
 * 应用记忆操作并保存文件
 */
async function applyMemoryOperations(
	memoryFiles: MemoryFiles,
	currentMemoryData: MemoryData,
	operations: MemoryOperations
): Promise<void> {
	// 处理全局记忆
	let updatedGlobalMemories = [...currentMemoryData.globalMemories]
	
	// 删除指定的全局记忆
	for (const deleteItem of operations.deleteGlobal) {
		updatedGlobalMemories = updatedGlobalMemories.filter(memory => memory !== deleteItem)
	}
	
	// 添加新的全局记忆
	updatedGlobalMemories.push(...operations.addGlobal)
	
	// 处理项目记忆
	let updatedProjectMemories = [...currentMemoryData.projectMemories]
	
	// 删除指定的项目记忆
	for (const deleteItem of operations.deleteProject) {
		updatedProjectMemories = updatedProjectMemories.filter(memory => memory !== deleteItem)
	}
	
	// 添加新的项目记忆
	updatedProjectMemories.push(...operations.addProject)
	
	// 保存全局记忆文件
	if (updatedGlobalMemories.length > 0) {
		await fs.mkdir(path.dirname(memoryFiles.globalMemoryPath), { recursive: true })
		await fs.writeFile(memoryFiles.globalMemoryPath, updatedGlobalMemories.join('\n'), "utf-8")
	} else if (await fileExistsAtPath(memoryFiles.globalMemoryPath)) {
		await fs.unlink(memoryFiles.globalMemoryPath)
	}
	
	// 保存项目记忆文件
	if (updatedProjectMemories.length > 0) {
		await fs.mkdir(path.dirname(memoryFiles.projectMemoryPath), { recursive: true })
		await fs.writeFile(memoryFiles.projectMemoryPath, updatedProjectMemories.join('\n'), "utf-8")
	} else if (await fileExistsAtPath(memoryFiles.projectMemoryPath)) {
		await fs.unlink(memoryFiles.projectMemoryPath)
	}
}


export async function saveMemory(provider: ClineProvider, text:string) {
	const system_prompt = `你是一个记忆管理助手。你的任务是汇总ai agent与用户的对话内容，发现其中需要ai agent长期保留的关键信息，作为ai agent的长期记忆，并与现有ai agent记忆进行合并，提供给ai agent在后续任务中快速了解用户。

记忆分为全局记忆和项目记忆：
- 全局记忆是针对用户的不区分工作区的描述。它与工作区无关，是对用户偏好、习惯、特点的描述，用于帮助LLM更好的和当前用户进行沟通，协助工作
- 项目记忆是针对当前工作区，所有文件或目录整体工作内容的描述。它是针对该工作区的长时记忆，用于帮助LLM在新任务中快速了解项目，进入当前项目的工作状态。

生成记忆请遵循但不限于以下要求：
对于全局记忆：
1. 分析当前对话记录，提取用户偏好、习惯、特点，可以包含简要的用户评价
2. 用户常用的技术决策和设计习惯
3. 常用的工具和配置
4. 对话中出现的典型的检查问题或debug的方法
5. 在查询源文件、获取上下文、查问题时的常用流程，例如遇到什么类型的问题时的常用工具和调用流程
6. 用户提出的长时间的要求，必要时请将相对时间改成具体时间一同记录，例如用户说："今天写注释的时候全部用英文，明天开始改用中文。"，你则需要把“今天”替换为具体日期。
x. 一系列可以让你成为用户工作伙伴的其他必要信息...

对于项目记忆：
1. 分析当前对话记录，提取重要信息、项目上下文等
2. 当前项目或特定文件中重要的技术决策和约定
3. 当前项目或特定文件中使用的关键设计模式、模块功能
4. 当前项目不同模块之间的关系
5. 当前项目相关的，搜索步骤复杂的知识性信息，记录下来防止后续用到时需要重复搜索
6. 当前项目或特定文件，添加某个特性或某个设计时的原因，如原始需求、设计思路等
7. 用户提出的长时间的要求，必要时请将相对时间改成具体时间一同记录，例如用户说：提醒我这个api只在4月15日前有效
x. 一系列可以让你成为用户工作伙伴的其他必要信息...

请遵循上述内容对记忆进行新增。

除对话信息外，用户还会将当前已有的历史记忆，作为上下文信息传递给你，每条历史记忆前包含一个序号，
1. 你需要判定历史记忆中是否有与当前对话中的信息相互矛盾的地方（可以并列同时共存的特性不应视为矛盾）。如果有显著矛盾，根据你的分析是否需要接受新的记忆，放弃历史记忆。如果选择新的对话中产生的记忆，请将历史记忆删除
2. 如果发现历史记忆中的信息与当前项目明显不符，显然属于过期信息，请将对应历史信息删除，例如今天已经6月10日，记忆针对的是6月10日之前的工作
3. 如果需要对历史记忆进行修改，请先删除对应历史记忆，并增加新的记忆

关键！输出时请注意：
0. 重要！记录的所有记忆站在ai agent的角度，即生成记忆中的"我"是ai agent，而不是用户！
1. 对于需要增加的全局记忆，每个全局记忆占一行，以"+ "开头
2. 对于需要增加的项目记忆，每个项目记忆占一行，以"++ "开头
3. 对于需要删除的全局记忆，每个项目记忆占一行，以"- "开头，后续内容需要与历史记忆中需要删除的对应条目完全一致
4. 对于需要删除的项目记忆，每个项目记忆占一行，以"-- "开头，后续内容需要与历史记忆中需要删除的对应条目完全一致
例如：
用户请求：
"
我是一个python初学者，当前项目是一个python学习项目，请帮我写一个斐波那契函数python实现，并增加中文注释

<AgentHistoryMemory>
<GlobalMemory>
1. 用户是一个python初学者
2. 用户不喜欢代码中包含注释
</GlobalMemory>

<ProjectMemory>
1. 当前项目是一个c++项目
</ProjectMemory>
</AgentHistoryMemory>
"
你的输出可能为:
"
++ 当前项目是一个python学习项目
- 2. 用户不喜欢代码中包含注释
-- 1. 当前项目是一个c++项目
"

注意：
- LLM上下文长度有限，请保持记忆的全面、详细、精确、有效，不要加入过多无用细节，必要时可以删除历史记忆中无效的废话
- 记忆间避免重复，必要时可以删除重复记忆
- 对于描述中的例子，可以作为参考，但不仅限于上述场景，宗旨是只要能够帮助用户进行记录完成工作即可。

请只返回以上格式处理后的记忆内容，不要添加解释或其他文本。
`
	// Add current time information with timezone.
	const now = new Date()

	const formatter = new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
		hour12: true,
	})

	const timeZone = formatter.resolvedOptions().timeZone
	const timeZoneOffset = -now.getTimezoneOffset() / 60 // Convert to hours and invert sign to match conventional notation
	const timeZoneOffsetHours = Math.floor(Math.abs(timeZoneOffset))
	const timeZoneOffsetMinutes = Math.abs(Math.round((Math.abs(timeZoneOffset) - timeZoneOffsetHours) * 60))
	const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : "-"}${timeZoneOffsetHours}:${timeZoneOffsetMinutes.toString().padStart(2, "0")}`

	const currentCline = provider.getCurrentCline()
	if (currentCline) {
		try {
			if (text.length !== 0) {
				await currentCline.say(
					"save_memory_tag",
					text,
					undefined /* images */,
					false /* partial */,
					undefined /* checkpoint */,
					undefined /* progressStatus */,
					{ isNonInteractive: true } /* options */,
				)
			}
			// 获取记忆文件路径
			const memoryFiles = await getMemoryFilePaths(provider)
			
			// 读取现有的记忆数据
			const currentMemoryData = await readMemoryFiles(memoryFiles)
			
			// 格式化历史记忆为AI输入格式
			const historyMemoryText = formatHistoryMemories(currentMemoryData)

			// 获取当前对话记录
			const messagesSinceLastSummary = getMessagesSinceLastSummary(currentCline.apiConversationHistory)
			
			// 清理图像块并准备用于 API 的消息
			const { apiConfiguration } = await provider.getState()
			const apiHandler = buildApiHandler(apiConfiguration)
			const cleanConversationHistory = maybeRemoveImageBlocks(messagesSinceLastSummary, apiHandler).map(
				({ role, content }) => ({ role, content })
			)

			// 构建消息数组
			const messages: Anthropic.MessageParam[] = []

			// 添加历史记忆作为系统上下文
			if (historyMemoryText) {
				messages.push({
					role: "user",
					content: historyMemoryText
				})
			}

			// 添加清理后的对话历史
			messages.push(...cleanConversationHistory)

			// 添加最终请求消息
			messages.push({
				role: "user",
				content: [{
					type: "text",
					text: `${text.length?"用户对保存记忆的要求是："+text:""}\n请根据以上对话内容${text.length?"、用户对记忆内容的要求":""}和现有记忆，生成更新后的记忆操作指令。`
				}, 
				{
					type: "text",
					text: `# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`
				}
				]
			})

			// 调用createMessage生成记忆操作
			const stream = apiHandler.createMessage(system_prompt, messages)

			let aiResponse = ""
			let cost = 0

			for await (const chunk of stream) {
				if (chunk.type === "text") {
					aiResponse += chunk.text
				} else if (chunk.type === "usage") {
					cost = chunk.totalCost ?? 0
				}
			}

			aiResponse = aiResponse.trim()

			if (aiResponse.length === 0) {
				throw new Error("AI返回的记忆操作为空")
			}

			// 解析AI返回的记忆操作
			const memoryOperations = parseMemoryOperations(aiResponse)
			
			// 应用记忆操作并保存文件
			await applyMemoryOperations(memoryFiles, currentMemoryData, memoryOperations)

			console.log("记忆操作已完成:")
			console.log("- 全局记忆文件:", memoryFiles.globalMemoryPath)
			console.log("- 项目记忆文件:", memoryFiles.projectMemoryPath)
			console.log("- 生成成本:", cost)

			// 创建摘要信息
			const operationSummary = generateOperationSummary(memoryOperations)
			let g_str = ""
			let p_str = ""
			
			const workspacePath = getWorkspacePath()
			// 检查全局记忆路径是否存在
			if (await fileExistsAtPath(memoryFiles.globalMemoryPath)) {
				if (workspacePath) {
					const globalMemoryPath = path.relative(workspacePath, memoryFiles.globalMemoryPath)
					g_str = `(全局记忆: [${memoryFiles.globalMemoryPath}](${globalMemoryPath}))\n`
				} else {
					g_str = `(全局记忆: ${memoryFiles.globalMemoryPath})\n`
				}
			}
			
			// 检查项目记忆路径是否存在
			if (await fileExistsAtPath(memoryFiles.projectMemoryPath)) {
				if (workspacePath) {
					const projectMemoryPath = path.relative(workspacePath, memoryFiles.projectMemoryPath)
					p_str = `(项目记忆: [${memoryFiles.projectMemoryPath}](${projectMemoryPath}))\n`
				} else {
					p_str = `(项目记忆: ${memoryFiles.projectMemoryPath})\n`
				}
			}

			const summary = `记忆已更新:\n${g_str}${p_str}\n\n操作详情: ${operationSummary}`
			const contextCondense: ContextCondense = { 
				summary, 
				cost, 
				newContextTokens: 0, 
				prevContextTokens: 0,
			}

			await currentCline.say(
				"save_memory",
				undefined /* text */,
				undefined /* images */,
				false /* partial */,
				undefined /* checkpoint */,
				undefined /* progressStatus */,
				{ isNonInteractive: true } /* options */,
				contextCondense,
			)

			// 创建通知文本，只包含存在的文件路径
			let notificationText = `记忆已更新 (成本: $${cost.toFixed(4)})`
			
			if (await fileExistsAtPath(memoryFiles.globalMemoryPath)) {
				notificationText += `\n全局: ${memoryFiles.globalMemoryPath}`
			}
			
			if (await fileExistsAtPath(memoryFiles.projectMemoryPath)) {
				notificationText += `\n项目: ${memoryFiles.projectMemoryPath}`
			}

			// 通知webview保存成功
			await provider.postMessageToWebview({ 
				type: "savedMemory", 
				success: true,
				text: notificationText
			})

		} catch (error) {
			console.error("保存记忆时出错:", error)

			await currentCline.say(
				"save_memory_error",
				"保存记忆错误" /* text */,
				undefined /* images */,
				false /* partial */,
				undefined /* checkpoint */,
				undefined /* progressStatus */,
				{ isNonInteractive: true } /* options */,
			)
			
			// 通知webview保存失败
			await provider.postMessageToWebview({ 
				type: "savedMemory", 
				success: false,
				text: `保存失败: ${error instanceof Error ? error.message : "未知错误"}`
			})
		}
	} else if (text.length !== 0) {
		try {
			// 获取记忆文件路径
			const memoryFiles = await getMemoryFilePaths(provider)
			
			// 读取现有的记忆数据
			const currentMemoryData = await readMemoryFiles(memoryFiles)
			
			// 格式化历史记忆为AI输入格式
			const historyMemoryText = formatHistoryMemories(currentMemoryData)

			// 清理图像块并准备用于 API 的消息
			const { apiConfiguration } = await provider.getState()
			const apiHandler = buildApiHandler(apiConfiguration)

			// 构建消息数组
			const messages: Anthropic.MessageParam[] = []

			// 添加历史记忆作为系统上下文
			if (historyMemoryText) {
				messages.push({
					role: "user",
					content: historyMemoryText
				})
			}

			// 添加最终请求消息
			messages.push({
				role: "user",
				content: [{
					type: "text",
					text: `${text}\n请根据以上对话内容${text.length?"、用户对记忆内容的要求":""}和现有记忆，生成更新后的记忆操作指令。`
				}, 
				{
					type: "text",
					text: `# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`
				}
				]
			})

			// 调用createMessage生成记忆操作
			const stream = apiHandler.createMessage(system_prompt, messages)

			let aiResponse = ""
			let cost = 0

			for await (const chunk of stream) {
				if (chunk.type === "text") {
					aiResponse += chunk.text
				} else if (chunk.type === "usage") {
					cost = chunk.totalCost ?? 0
				}
			}

			aiResponse = aiResponse.trim()

			if (aiResponse.length === 0) {
				throw new Error("AI返回的记忆操作为空")
			}

			// 解析AI返回的记忆操作
			const memoryOperations = parseMemoryOperations(aiResponse)
			
			// 应用记忆操作并保存文件
			await applyMemoryOperations(memoryFiles, currentMemoryData, memoryOperations)

			console.log("记忆操作已完成:")
			console.log("- 全局记忆文件:", memoryFiles.globalMemoryPath)
			console.log("- 项目记忆文件:", memoryFiles.projectMemoryPath)
			console.log("- 生成成本:", cost)

			// 创建摘要信息
			const operationSummary = generateOperationSummary(memoryOperations)

			// 创建通知文本，只包含存在的文件路径
			let notificationText = `记忆已更新 (成本: $${cost.toFixed(4)})`
			
			if (await fileExistsAtPath(memoryFiles.globalMemoryPath)) {
				notificationText += `\n全局: ${memoryFiles.globalMemoryPath}`
			}
			
			if (await fileExistsAtPath(memoryFiles.projectMemoryPath)) {
				notificationText += `\n项目: ${memoryFiles.projectMemoryPath}`
			}

			// 通知webview保存成功
			await provider.postMessageToWebview({ 
				type: "savedMemory", 
				success: true,
				text: notificationText
			})

			// 显示VS Code右下角通知
			vscode.window.showInformationMessage(`Roo 记忆已保存`)

		} catch (error) {
			console.error("保存记忆时出错:", error)
			
			// 通知webview保存失败
			await provider.postMessageToWebview({ 
				type: "savedMemory", 
				success: false,
				text: `保存失败: ${error instanceof Error ? error.message : "未知错误"}`
			})
		}
	} else {
		// 没有活跃任务时，直接返回成功消息
		await provider.postMessageToWebview({ type: "savedMemory", success: true })
	}
}