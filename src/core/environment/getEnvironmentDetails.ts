import path from "path"
import os from "os"

import * as vscode from "vscode"
import pWaitFor from "p-wait-for"
import delay from "delay"

import type { ExperimentId, TodoItem, ToolName } from "@roo-code/types"
import { DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT } from "@roo-code/types"

import { EXPERIMENT_IDS, experiments as Experiments } from "../../shared/experiments"
import { formatLanguage } from "../../shared/language"
import { defaultModeSlug, getFullModeDetails, getModeBySlug, isToolAllowedForMode } from "../../shared/modes"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { listFiles } from "../../services/glob/list-files"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../integrations/terminal/Terminal"
import { arePathsEqual } from "../../utils/path"
import { formatResponse } from "../prompts/responses"

import { EditorUtils } from "../../integrations/editor/EditorUtils"
import { readLines } from "../../integrations/misc/read-lines"
import { addLineNumbers } from "../../integrations/misc/extract-text"

import { Task } from "../task/Task"
import { formatReminderSection } from "./reminder"

import { getWorkspacePath } from "../../utils/path"
import { fileExistsAtPath } from "../../utils/fs"
import fs from "fs/promises"
import { ApiMessage } from "../task-persistence/apiMessages"


interface MemoryFiles {
	globalMemoryPath: string
	projectMemoryPath: string
}

interface MemoryData {
	globalMemories: string[]
	projectMemories: string[]
}

/**
 * 获取记忆文件路径
 */
export async function getMemoryFilePaths(globalStoragePath: string): Promise<MemoryFiles> {
	const globalMemoryPath = path.join(globalStoragePath, "global-memory.md")

	const workspacePath = getWorkspacePath()
	if (!workspacePath) {
		throw new Error("无法获取工作区路径")
	}

	const projectMemoryDir = path.join(workspacePath, ".roo")
	const projectMemoryPath = path.join(projectMemoryDir, "project-memory.md")

	return {
		globalMemoryPath,
		projectMemoryPath,
	}
}

/**
 * 读取记忆文件内容
 */
export async function readMemoryFiles(memoryFiles: MemoryFiles): Promise<MemoryData> {
	const globalMemories: string[] = []
	const projectMemories: string[] = []

	// 读取全局记忆
	if (await fileExistsAtPath(memoryFiles.globalMemoryPath)) {
		try {
			const content = await fs.readFile(memoryFiles.globalMemoryPath, "utf-8")
			const lines = content.split("\n").filter((line) => line.trim())
			globalMemories.push(...lines)
		} catch (error) {
			console.log("无法读取全局记忆文件:", error)
		}
	}

	// 读取项目记忆
	if (await fileExistsAtPath(memoryFiles.projectMemoryPath)) {
		try {
			const content = await fs.readFile(memoryFiles.projectMemoryPath, "utf-8")
			const lines = content.split("\n").filter((line) => line.trim())
			projectMemories.push(...lines)
		} catch (error) {
			console.log("无法读取项目记忆文件:", error)
		}
	}

	return {
		globalMemories,
		projectMemories,
	}
}

/**
 * 格式化记忆内容为显示格式
 */
export function formatMemoryContent(memoryData: MemoryData): string {
	if (memoryData.globalMemories.length === 0 && memoryData.projectMemories.length === 0) {
		return "No memory data available"
	}

	let formatted = "The content of Agent memory includes records of Roo's understanding of user needs from past work, as well as insights into user habits and projects.\n\n"

	if (memoryData.globalMemories.length > 0) {
		formatted += "# Global Memory:\n"
		memoryData.globalMemories.forEach((memory, index) => {
			formatted += `${memory}\n`
		})
		formatted += "\n"
	}

	if (memoryData.projectMemories.length > 0) {
		formatted += "# Project Memory:\n"
		memoryData.projectMemories.forEach((memory, index) => {
			formatted += `${memory}\n`
		})
	}

	return formatted.trim()
}

/**
 * 获取代办中所有正在进行的项，如果没有正在进行的项目则获取第一个未进行的项目，
 * 判断这些项目的类型（analysis/planning/editing），组成一个任务类型set
 */
function getTodoTaskTypes(cline: Task): Set<string> | undefined {
	if (!cline.todoList || cline.todoList.length === 0) {
		return undefined
	}

	// 先查找所有正在进行的项目
	const inProgressTodos = cline.todoList.filter(todo => todo.status === "in_progress")
	
	let todosToAnalyze: TodoItem[]
	if (inProgressTodos.length > 0) {
		// 如果有正在进行的项目，使用这些项目
		todosToAnalyze = inProgressTodos
	} else {
		// 如果没有正在进行的项目，获取第一个待处理的项目
		const pendingTodos = cline.todoList.filter(todo => todo.status === "pending")
		todosToAnalyze = pendingTodos.length > 0 ? [pendingTodos[0]] : []
	}

	// 分析任务类型
	const taskTypes = new Set<string>()
	
	for (const todo of todosToAnalyze) {
		// 从任务内容中提取类型标记，例如 [analysis], [planning], [editing]
		const typeMatch = todo.content.match(/\[(\w+)\]/)
		if (typeMatch) {
			const taskType = typeMatch[1].toLowerCase()
			if (["analysis", "planning", "editing"].includes(taskType)) {
				taskTypes.add(taskType)
			}
		} else {
			// 如果没有明确的类型标记，根据关键词判断类型
			const content = todo.content.toLowerCase()
			if (content.includes("analyz") || content.includes("research") || content.includes("understand") || content.includes("investigate")) {
				taskTypes.add("analysis")
			} else if (content.includes("plan") || content.includes("design") || content.includes("architect") || content.includes("structure")) {
				taskTypes.add("planning")
			} else if (content.includes("implement") || content.includes("write") || content.includes("create") || content.includes("edit") || content.includes("fix") || content.includes("update")) {
				taskTypes.add("editing")
			}
		}
	}

	return taskTypes
}


const generateDiagnosticText = (diagnostics?: any[]) => {
	if (!diagnostics?.length) return ""
	return `\nCurrent problems detected:\n${diagnostics
		.map((d) => `- [${d.source || "Error"}] ${d.message}${d.code ? ` (${d.code})` : ""}`)
		.join("\n")}`
}




export async function getEnvironmentDetails(cline: Task, includeFileDetails: boolean = false) {
	let details = ""
	const clineProvider = cline.providerRef.deref()
	const state = await clineProvider?.getState()
	const {
		terminalOutputLineLimit = 500,
		terminalOutputCharacterLimit = DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
		maxWorkspaceFiles = 200,
	} = state ?? {}
	
	if (includeFileDetails) {
		// It could be useful for cline to know if the user went from one or no
		// file to another between messages, so we always include this context.
		details += "\n\n# VSCode Visible Files"

		const visibleFilePaths = vscode.window.visibleTextEditors
			?.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(cline.cwd, absolutePath))
			.slice(0, maxWorkspaceFiles)

		// Filter paths through rooIgnoreController
		const allowedVisibleFiles = cline.rooIgnoreController
			? cline.rooIgnoreController.filterPaths(visibleFilePaths)
			: visibleFilePaths.map((p) => p.toPosix()).join("\n")

		if (allowedVisibleFiles) {
			details += `\n${allowedVisibleFiles}`
		} else {
			details += "\n(No visible files)"
		}

		details += "\n\n# VSCode Open Tabs"
		const { maxOpenTabsContext } = state ?? {}
		const maxTabs = maxOpenTabsContext ?? 20
		const openTabPaths = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.filter((tab) => tab.input instanceof vscode.TabInputText)
			.map((tab) => (tab.input as vscode.TabInputText).uri.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(cline.cwd, absolutePath).toPosix())
			.slice(0, maxTabs)

		// Filter paths through rooIgnoreController
		const allowedOpenTabs = cline.rooIgnoreController
			? cline.rooIgnoreController.filterPaths(openTabPaths)
			: openTabPaths.map((p) => p.toPosix()).join("\n")

		if (allowedOpenTabs) {
			details += `\n${allowedOpenTabs}`
		} else {
			details += "\n(No open tabs)"
		}
	}

		// // Get task-specific and background terminals.
		// const busyTerminals = [
		// 	...TerminalRegistry.getTerminals(true, cline.taskId),
		// 	...TerminalRegistry.getBackgroundTerminals(true),
		// ]

		// const inactiveTerminals = [
		// 	...TerminalRegistry.getTerminals(false, cline.taskId),
		// 	...TerminalRegistry.getBackgroundTerminals(false),
		// ]

		// if (busyTerminals.length > 0) {
		// 	if (cline.didEditFile) {
		// 		await delay(300) // Delay after saving file to let terminals catch up.
		// 	}

		// 	// Wait for terminals to cool down.
		// 	await pWaitFor(() => busyTerminals.every((t) => !TerminalRegistry.isProcessHot(t.id)), {
		// 		interval: 100,
		// 		timeout: 5_000,
		// 	}).catch(() => {})
		// }

		// // Reset, this lets us know when to wait for saved files to update terminals.
		// cline.didEditFile = false

		// // Waiting for updated diagnostics lets terminal output be the most
		// // up-to-date possible.
		// let terminalDetails = ""

		// if (busyTerminals.length > 0) {
		// 	// Terminals are cool, let's retrieve their output.
		// 	terminalDetails += "\n\n# Actively Running Terminals"

		// 	for (const busyTerminal of busyTerminals) {
		// 		const cwd = busyTerminal.getCurrentWorkingDirectory()
		// 		terminalDetails += `\n## Terminal ${busyTerminal.id} (Active)`
		// 		terminalDetails += `\n### Working Directory: \`${cwd}\``
		// 		terminalDetails += `\n### Original command: \`${busyTerminal.getLastCommand()}\``
		// 		let newOutput = TerminalRegistry.getUnretrievedOutput(busyTerminal.id)

		// 		if (newOutput) {
		// 			newOutput = Terminal.compressTerminalOutput(
		// 				newOutput,
		// 				terminalOutputLineLimit,
		// 				terminalOutputCharacterLimit,
		// 			)
		// 			terminalDetails += `\n### New Output\n${newOutput}`
		// 		}
		// 	}
		// }

		// // First check if any inactive terminals in this task have completed
		// // processes with output.
		// const terminalsWithOutput = inactiveTerminals.filter((terminal) => {
		// 	const completedProcesses = terminal.getProcessesWithOutput()
		// 	return completedProcesses.length > 0
		// })

		// // Only add the header if there are terminals with output.
		// if (terminalsWithOutput.length > 0) {
		// 	terminalDetails += "\n\n# Inactive Terminals with Completed Process Output"

		// 	// Process each terminal with output.
		// 	for (const inactiveTerminal of terminalsWithOutput) {
		// 		let terminalOutputs: string[] = []

		// 		// Get output from completed processes queue.
		// 		const completedProcesses = inactiveTerminal.getProcessesWithOutput()

		// 		for (const process of completedProcesses) {
		// 			let output = process.getUnretrievedOutput()

		// 			if (output) {
		// 				output = Terminal.compressTerminalOutput(
		// 					output,
		// 					terminalOutputLineLimit,
		// 					terminalOutputCharacterLimit,
		// 				)
		// 				terminalOutputs.push(`Command: \`${process.command}\`\n${output}`)
		// 			}
		// 		}

		// 		// Clean the queue after retrieving output.
		// 		inactiveTerminal.cleanCompletedProcessQueue()

		// 		// Add this terminal's outputs to the details.
		// 		if (terminalOutputs.length > 0) {
		// 			const cwd = inactiveTerminal.getCurrentWorkingDirectory()
		// 			terminalDetails += `\n## Terminal ${inactiveTerminal.id} (Inactive)`
		// 			terminalDetails += `\n### Working Directory: \`${cwd}\``
		// 			terminalOutputs.forEach((output) => {
		// 				terminalDetails += `\n### New Output\n${output}`
		// 			})
		// 		}
		// 	}
		// }

		// // console.log(`[Task#getEnvironmentDetails] terminalDetails: ${terminalDetails}`)

		// // Add recently modified files section.
		// const recentlyModifiedFiles = cline.fileContextTracker.getAndClearRecentlyModifiedFiles()

		// if (recentlyModifiedFiles.length > 0) {
		// 	details +=
		// 		"\n\n# Recently Modified Files\nThese files have been modified since you last accessed them (file was just edited so you may need to re-read it before editing):"
		// 	for (const filePath of recentlyModifiedFiles) {
		// 		details += `\n${filePath}`
		// 	}
		// }

		// if (terminalDetails) {
		// 	details += terminalDetails
		// }

		// Add current time information with timezone.
		const now = new Date()

		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		const timeZoneOffset = -now.getTimezoneOffset() / 60 // Convert to hours and invert sign to match conventional notation
		const timeZoneOffsetHours = Math.floor(Math.abs(timeZoneOffset))
		const timeZoneOffsetMinutes = Math.abs(Math.round((Math.abs(timeZoneOffset) - timeZoneOffsetHours) * 60))
		const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : "-"}${timeZoneOffsetHours}:${timeZoneOffsetMinutes.toString().padStart(2, "0")}`
		details += `\n\n# Current Time\nCurrent time in ISO 8601 UTC format: ${now.toISOString()}\nUser time zone: ${timeZone}, UTC${timeZoneOffsetStr}`

		// Add context tokens information.
		const { contextTokens, totalCost } = getApiMetrics(cline.clineMessages)
		const { id: modelId } = cline.api.getModel()

		// details += `\n\n# Current Cost\n${totalCost !== null ? `$${totalCost.toFixed(2)}` : "(Not available)"}`

		// Add current mode and any mode-specific warnings.
		const {
			mode,
			customModes,
			customModePrompts,
			experiments = {} as Record<ExperimentId, boolean>,
			customInstructions: globalCustomInstructions,
			language,
		} = state ?? {}

		const currentMode = mode ?? defaultModeSlug

		const modeDetails = await getFullModeDetails(currentMode, customModes, customModePrompts, {
			cwd: cline.cwd,
			globalCustomInstructions,
			language: language ?? formatLanguage(vscode.env.language),
		})

		details += `\n\n# Current Mode\n`
		details += `<slug>${currentMode}</slug>\n`
		details += `<name>${modeDetails.name}</name>\n`
		details += `<model>${modelId}</model>\n`

		if (Experiments.isEnabled(experiments ?? {}, EXPERIMENT_IDS.POWER_STEERING)) {
			details += `<role>${modeDetails.roleDefinition}</role>\n`

			if (modeDetails.customInstructions) {
				details += `<custom_instructions>${modeDetails.customInstructions}</custom_instructions>\n`
			}
		}

	if (includeFileDetails) {
		details += `\n\n# Current Workspace Directory (${cline.cwd.toPosix()})\n`
		details += "(Only folders are included. Files not shown automatically.)\n"
		const isDesktop = arePathsEqual(cline.cwd, path.join(os.homedir(), "Desktop"))

		if (isDesktop) {
			// Don't want to immediately access desktop since it would show
			// permission popup.
			details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
		} else {
			const maxFiles = maxWorkspaceFiles ?? 200

			// Early return for limit of 0
			if (maxFiles === 0) {
				details += "(Workspace files context disabled. Use list_files to explore if needed.)"
			} else {
				const [files, didHitLimit] = await listFiles(cline.cwd, true, maxFiles, "dir_only")
				const { showRooIgnoredFiles = true } = state ?? {}

				const result = formatResponse.formatFilesList(
					cline.cwd,
					files,
					didHitLimit,
					cline.rooIgnoreController,
					showRooIgnoredFiles,
				)

				details += result
				details += `\n('dir_only' mode, show directories only, you can understand the structure of the current project from this directory)\n`
			}
		}
	
		const globalStoragePath = cline.providerRef.deref()?.context.globalStorageUri.fsPath
		if (globalStoragePath) {
			try {
				const memoryFiles = await getMemoryFilePaths(globalStoragePath)
				const memoryData = await readMemoryFiles(memoryFiles)
				const formattedMemory = formatMemoryContent(memoryData)
				details += `\n\n# Agent Memory Content\n${formattedMemory}\n\n(If there are reminders or to-do items due, please notify the user.)\n`
			} catch (error) {
				details += `\n\n# Agent Memory Content\nError reading memory: ${error.message}\n`
			}
		}
	
		let filePath: string
		let selectedText: string
		let startLine: number | undefined
		let endLine: number | undefined
		let diagnostics: any[] | undefined
		const context = EditorUtils.getEditorContext()
		if (context) {
			;({ filePath, selectedText, startLine, endLine, diagnostics } = context)
			const fullPath = path.resolve(cline.cwd, filePath)
			if (endLine !== undefined && startLine != undefined) {
				try {
					// Check if file is readable
					await vscode.workspace.fs.stat(vscode.Uri.file(fullPath))
					details += `\n\n# The File Where The Cursor In\n${fullPath}\n`
					const content = addLineNumbers(
						await readLines(fullPath, endLine + 5, startLine - 5),
						startLine - 4 > 1 ? startLine - 4: 1,
					)
					details += `\n# Line near the Cursor\n${content}\n(The cursor is on the line ${endLine}. Determine if the user's question is related to the code near the cursor.)\n\n`
					if (diagnostics) {
						const diagno = generateDiagnosticText(diagnostics)
						details += `\n# Issues near the Cursor\n${diagno}\n`
					}
				} catch (error) {}
			}
		}
	}

	const reminderSection = formatReminderSection(cline.todoList)
	return `<environment_details>\n${details.trim()}\n${reminderSection}\n</environment_details>`
}


// /**
// 	* 删除用户推荐提示词
// 	* 遍历cline的历史聊天记录后3个用户角色的记录，每个用户消息记录应该都是数组，
// 	* 不是数组的忽略，删除数组中所有内容类型为"text"，内容由<user_suggestions>开头的对话块，
// 	* 然后将修改后的聊天记录设回给cline
// 	*/
// export async function removeUserSuggestions(cline: Task): Promise<void> {
// 	// 获取历史聊天记录
// 	const conversationHistory = [...cline.apiConversationHistory]
	
// 	// 找到所有用户角色的消息记录
// 	const userMessages: ApiMessage[] = conversationHistory.filter(msg => msg.role === "user")
	
// 	// 只处理最后3个用户消息
// 	const lastThreeUserMessages = userMessages.slice(-3)
	
// 	// 遍历这3个用户消息
// 	for (const message of lastThreeUserMessages) {
// 		// 检查消息内容是否为数组
// 		if (Array.isArray(message.content)) {
// 			// 过滤掉内容类型为"text"且内容由<user_suggestions>开头的对话块
// 			const filteredContent = message.content.filter((block: any) => {
// 				if (block.type === "text" && typeof block.text === "string") {
// 					return !block.text.startsWith("<user_suggestions>")
// 				}
// 				return true
// 			})
			
// 			// 更新消息内容
// 			message.content = filteredContent
// 		}
// 	}
	
// 	// 将修改后的聊天记录设回给cline
// 	await cline.overwriteApiConversationHistory(conversationHistory)
// }

import { CodeIndexManager } from "../../services/code-index/manager"

export async function getUserSuggestions(cline: Task): Promise<string|undefined> {
	if (cline.toolSequence.length >= 5) {
		cline.toolSequence = cline.toolSequence.slice(-5)
	}

	const lastTool = cline.toolSequence.length ? cline.toolSequence[cline.toolSequence.length - 1] : undefined
	let toolRepeat = 1
	
	// Count backwards from the second last element
	for (let i = cline.toolSequence.length - 2; i >= 0; i--) {
		if (cline.toolSequence[i] === lastTool) {
			toolRepeat++
		} else {
			break
		}
	}

	const toolTimes = cline.toolSequence.filter(t => t === lastTool).length

	const provider = cline.providerRef.deref()
	let isCodebaseSearchAvailable = false
	if (provider) {
		const codeIndexManager = CodeIndexManager.getInstance(provider.context)
		isCodebaseSearchAvailable = provider &&
		codeIndexManager !== undefined &&
		codeIndexManager.isFeatureEnabled &&
		codeIndexManager.isFeatureConfigured &&
		codeIndexManager.isInitialized
	}

// 	const startNewTask = isCodebaseSearchAvailable ? `- The \`codebase_search\` tool is a powerful tool that can help you quickly find clues to start a task using semantic search at the beginning of the task. But its results can be inaccurate and incomplete, often missing a lot of relevant information. After an initial search, you should analyze the results, extract useful information, rewrite your query, and design a new, broader search.
// - Because \`codebase_search\` can miss information, you should, at the appropriate time and based on the information you already have, deeply understand the known code and begin using \`Glob\`, \`Grep\`, \`list_code_definition_names\` or \`list_files\` for more precise and comprehensive searches. Use these tools to gain a more complete understanding of the code structure.
// - Then, start widely using \`Glob\`, \`Grep\`, \`list_files\` and \`list_code_definition_names\` to conduct more accurate and comprehensive large-scale searches. Use these tools to gain a more complete understanding of the code structure.
// - After this, you can use other tools like \`read_file\` to obtain the most complete and detailed contextual information.
// `:
// `- At the beginning of a task, you should widely use \`Glob\`, \`Grep\` to understand the directory structure, scope of functionality, or keywords involved in the project.
// - You can use the \`read_file\` tool to read files you are interested in. Based on the information obtained from \`Glob\` and \`Grep\`, you can select and read only specific sections (a range of line numbers) to confirm if the file's content is relevant to the task.
// - After finding relevant code clues, combine them with the information you already have to deeply understand the known code. Then, start using \`Glob\`, \`Grep\`, \`list_code_definition_names\` or \`list_files\` to conduct more accurate and comprehensive large-scale searches. Use these tools to gain a more complete understanding of the code structure.
// - Following this, you can use \`read_file\` and other context-gathering tools to obtain the most complete and detailed information.
// ` 

	const UserSuggestions : Array<string> = []

	switch (lastTool) {
		case undefined:
			// UserSuggestions.push("- When you first receive the task, You should to analyze the key points of the task and plan a general direction for solving the problem.")
			// UserSuggestions.push("- Analyze the meaning of each key point in the task within the project.")
			// UserSuggestions.push("- Use the `update_todo_list` tool to plan the task if required.")
			// UserSuggestions.push("- Be thorough: Check multiple locations, consider different naming conventions, look for related files. ")
			// UserSuggestions.push("- For analysis: Start broad and narrow down. Use multiple search strategies if the first doesn't yield results.")
			// UserSuggestions.push(startNewTask)
			break
		case "execute_command":
			break
		case "read_file":
			// UserSuggestions.push("- Attention! The number of lines you read in a file is limited, so never assume you've read the entire file and thus miss information. If necessary, you should use a search tool to locate the line number range of the content you need to find, and then read specific lines.")
			// UserSuggestions.push("- If you discover key fields that involve critical logic, you should to use the search tool to search for their scope of influence.")
			// if (toolTimes > 3) {
			// 	UserSuggestions.push("- You cannot understand the scope of the functionality simply by reading the files, as this is very inefficient. You should use search tools to extensively query the files involved in the functionality.")
			// }
			break
		case "write_to_file":
			break
		case "apply_diff":
			break
		case "insert_content":
			break
		case "search_and_replace":
			break
		case "glob":
			break
		case "grep":
			// UserSuggestions.push("- Be thorough: Check multiple locations, consider different naming conventions, look for related files. ")
			// UserSuggestions.push("- You can try selecting more patterns or keywords from tasks or known information to conduct a broader search.")
			// UserSuggestions.push("- If you discover key fields that involve critical logic, you should to use the search tool to search for their scope of influence.")
			break
		case "list_files":
			break
		case "list_code_definition_names":
			break
		case "browser_action":
			break
		case "use_mcp_tool":
			break
		case "access_mcp_resource":
			break
		case "ask_followup_question":
			break
		case "attempt_completion":
			// UserSuggestions.push("- Use the `update_todo_list` tool to plan the task if required.")
			// UserSuggestions.push(startNewTask)
			break
		case "switch_mode":
			break
		case "new_task":
			UserSuggestions.push("- Review whether the subtasks you created return the results you expected. If the subtasks do not return the results you are satisfied with, you can restart the subtasks and describe the requirements more detailedly.")
			break
		case "fetch_instructions":
			break
		case "codebase_search":
			// UserSuggestions.push("- If you discover key fields that involve critical logic, you should to use the search tool to search for their scope of influence.")
			// if (toolTimes > 3) {
			// 	UserSuggestions.push(startNewTask)
			// }
			break
		case "update_todo_list": {
			UserSuggestions.push("- IMPORTANT: Based on the current available information, re-analyze the user task in depth and plan the upcoming work. If necessary, create a new to-do list")
			cline.toolSequence.push("review")
			UserSuggestions.push("- IMPORTANT: Reflect on whether the phased tasks have been truly completed, consider whether it is comprehensive, and identify if there are omissions that need to be rolled back for further processing")
			break
		}
		case "web_search":
			break
		case "url_fetch":
			break
		default:
			break
	}

	if (cline.toolSequence.length > 4 && !cline.toolSequence.includes("review")) {
		UserSuggestions.push("- IMPORTANT: Based on the current available information, re-analyze the user task in depth and plan the upcoming work. If necessary, create a new to-do list")
		cline.toolSequence.push("review")
	}

	return UserSuggestions.join("\n") || undefined
}