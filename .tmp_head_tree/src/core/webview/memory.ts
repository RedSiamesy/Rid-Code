import * as path from "path"
import fs from "fs/promises"
import Anthropic from "@anthropic-ai/sdk"

import { type ContextCondense } from "@roo-code/types"

import { ClineProvider } from "./ClineProvider"
import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"
import { buildApiHandler } from "../../api"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"
import { getMessagesSinceLastSummary } from "../condense"

interface MemoryFiles {
	globalMemoryPath: string
	projectMemoryPath?: string
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

async function getMemoryFilePaths(provider: ClineProvider): Promise<MemoryFiles> {
	const globalStoragePath = provider.contextProxy.globalStorageUri.fsPath
	const globalMemoryPath = path.join(globalStoragePath, "global-memory.md")

	const workspacePath = getWorkspacePath()
	const projectMemoryPath = workspacePath ? path.join(workspacePath, ".roo", "project-memory.md") : undefined

	return {
		globalMemoryPath,
		projectMemoryPath,
	}
}

async function readMemoryFiles(memoryFiles: MemoryFiles): Promise<MemoryData> {
	const globalMemories: string[] = []
	const projectMemories: string[] = []

	if (await fileExistsAtPath(memoryFiles.globalMemoryPath)) {
		try {
			const content = await fs.readFile(memoryFiles.globalMemoryPath, "utf-8")
			const lines = content.split("\n").map((line) => line.trim()).filter(Boolean)
			globalMemories.push(...lines)
		} catch (error) {
			console.warn("Failed to read global memory file:", error)
		}
	}

	if (memoryFiles.projectMemoryPath && (await fileExistsAtPath(memoryFiles.projectMemoryPath))) {
		try {
			const content = await fs.readFile(memoryFiles.projectMemoryPath, "utf-8")
			const lines = content.split("\n").map((line) => line.trim()).filter(Boolean)
			projectMemories.push(...lines)
		} catch (error) {
			console.warn("Failed to read project memory file:", error)
		}
	}

	return { globalMemories, projectMemories }
}

function formatHistoryMemories(memoryData: MemoryData): string {
	if (memoryData.globalMemories.length === 0 && memoryData.projectMemories.length === 0) {
		return ""
	}

	let formatted = "<AgentHistoryMemory>\n"

	if (memoryData.globalMemories.length > 0) {
		formatted += "<GlobalMemory>\n"
		for (const memory of memoryData.globalMemories) {
			formatted += `${memory}\n`
		}
		formatted += "</GlobalMemory>\n\n"
	}

	if (memoryData.projectMemories.length > 0) {
		formatted += "<ProjectMemory>\n"
		for (const memory of memoryData.projectMemories) {
			formatted += `${memory}\n`
		}
		formatted += "</ProjectMemory>\n"
	}

	formatted += "</AgentHistoryMemory>"

	return formatted
}

function parseMemoryOperations(aiResponse: string): MemoryOperations {
	const lines = aiResponse.split("\n").map((line) => line.trim()).filter(Boolean)

	const operations: MemoryOperations = {
		addGlobal: [],
		addProject: [],
		deleteGlobal: [],
		deleteProject: [],
	}

	for (const line of lines) {
		if (line.startsWith("++ ")) {
			operations.addProject.push(line.slice(3).trim())
			continue
		}
		if (line.startsWith("+ ")) {
			operations.addGlobal.push(line.slice(2).trim())
			continue
		}
		if (line.startsWith("-- ")) {
			operations.deleteProject.push(line.slice(3).trim())
			continue
		}
		if (line.startsWith("- ")) {
			operations.deleteGlobal.push(line.slice(2).trim())
		}
	}

	return operations
}

function generateOperationSummary(operations: MemoryOperations): string {
	const parts: string[] = []

	if (operations.addGlobal.length > 0) {
		parts.push(`Added ${operations.addGlobal.length} global memory entries`)
	}
	if (operations.deleteGlobal.length > 0) {
		parts.push(`Removed ${operations.deleteGlobal.length} global memory entries`)
	}
	if (operations.addProject.length > 0) {
		parts.push(`Added ${operations.addProject.length} project memory entries`)
	}
	if (operations.deleteProject.length > 0) {
		parts.push(`Removed ${operations.deleteProject.length} project memory entries`)
	}

	return parts.length > 0 ? parts.join("; ") : "No memory changes"
}

async function applyMemoryOperations(
	memoryFiles: MemoryFiles,
	currentMemoryData: MemoryData,
	operations: MemoryOperations,
): Promise<void> {
	let updatedGlobalMemories = [...currentMemoryData.globalMemories]
	let updatedProjectMemories = [...currentMemoryData.projectMemories]

	if (operations.deleteGlobal.length > 0) {
		updatedGlobalMemories = updatedGlobalMemories.filter((memory) => !operations.deleteGlobal.includes(memory))
	}
	if (operations.deleteProject.length > 0) {
		updatedProjectMemories = updatedProjectMemories.filter(
			(memory) => !operations.deleteProject.includes(memory),
		)
	}

	if (operations.addGlobal.length > 0) {
		updatedGlobalMemories.push(...operations.addGlobal)
	}
	if (operations.addProject.length > 0) {
		updatedProjectMemories.push(...operations.addProject)
	}

	if (updatedGlobalMemories.length > 0) {
		await fs.mkdir(path.dirname(memoryFiles.globalMemoryPath), { recursive: true })
		await fs.writeFile(memoryFiles.globalMemoryPath, updatedGlobalMemories.join("\n"), "utf-8")
	} else if (await fileExistsAtPath(memoryFiles.globalMemoryPath)) {
		await fs.unlink(memoryFiles.globalMemoryPath)
	}

	if (memoryFiles.projectMemoryPath) {
		if (updatedProjectMemories.length > 0) {
			await fs.mkdir(path.dirname(memoryFiles.projectMemoryPath), { recursive: true })
			await fs.writeFile(memoryFiles.projectMemoryPath, updatedProjectMemories.join("\n"), "utf-8")
		} else if (await fileExistsAtPath(memoryFiles.projectMemoryPath)) {
			await fs.unlink(memoryFiles.projectMemoryPath)
		}
	}
}

export async function saveMemory(provider: ClineProvider, text: string): Promise<void> {
	const systemPrompt = `You are a memory manager for the assistant.

You will be given:
- Existing memories in <AgentHistoryMemory> (global and project scopes).
- Recent conversation messages.
- An optional user request about what to remember.

Global memory is user-level preferences, habits, tools, and workflows.
Project memory is long-lived facts about the current workspace: architecture, conventions, and key decisions.

Output ONLY memory operations, one per line, using:
+ <global memory to add>
- <global memory to delete>
++ <project memory to add>
-- <project memory to delete>

If an entry is outdated or contradicted, delete it. If replacing an entry, delete the old one then add the new one.
Keep each memory entry to a single line. Do not include any extra text or explanation.`

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
	const timeZoneOffset = -now.getTimezoneOffset() / 60
	const timeZoneOffsetHours = Math.floor(Math.abs(timeZoneOffset))
	const timeZoneOffsetMinutes = Math.abs(Math.round((Math.abs(timeZoneOffset) - timeZoneOffsetHours) * 60))
	const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : "-"}${timeZoneOffsetHours}:${timeZoneOffsetMinutes
		.toString()
		.padStart(2, "0")}`

	const currentTask = provider.getCurrentTask()

	if (!currentTask && text.trim().length === 0) {
		await provider.postMessageToWebview({ type: "savedMemory", success: true })
		return
	}

	if (currentTask && text.trim().length > 0) {
		await currentTask.say(
			"save_memory_tag",
			text,
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: true },
		)
	}

	try {
		const memoryFiles = await getMemoryFilePaths(provider)
		const currentMemoryData = await readMemoryFiles(memoryFiles)
		const historyMemoryText = formatHistoryMemories(currentMemoryData)

		const { apiConfiguration } = await provider.getState()
		const apiHandler = buildApiHandler(apiConfiguration)

		const messages: Anthropic.MessageParam[] = []

		if (historyMemoryText) {
			messages.push({ role: "user", content: historyMemoryText })
		}

		if (currentTask) {
			const messagesSinceLastSummary = getMessagesSinceLastSummary(currentTask.apiConversationHistory)
			const cleanConversationHistory = maybeRemoveImageBlocks(messagesSinceLastSummary, apiHandler).map(
				({ role, content }) => ({ role, content }),
			)
			messages.push(...cleanConversationHistory)
		}

		const userRequestText = text.trim().length > 0 ? `User memory request: ${text.trim()}` : "No explicit request."

		messages.push({
			role: "user",
			content: [
				{
					type: "text",
					text: `${userRequestText}\nGenerate updated memory operations based on the conversation and existing memories.`,
				},
				{
					type: "text",
					text: `# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`,
				},
			],
		})

		const stream = apiHandler.createMessage(systemPrompt, messages)

		let aiResponse = ""
		let cost = 0

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				aiResponse += chunk.text
			} else if (chunk.type === "usage") {
				cost = chunk.totalCost ?? 0
			}
		}

		const trimmedResponse = aiResponse.trim()
		if (!trimmedResponse) {
			throw new Error("No memory operations returned by model.")
		}

		const memoryOperations = parseMemoryOperations(trimmedResponse)
		await applyMemoryOperations(memoryFiles, currentMemoryData, memoryOperations)

		const operationSummary = generateOperationSummary(memoryOperations)
		const summaryLines: string[] = ["Memory updated."]

		if (await fileExistsAtPath(memoryFiles.globalMemoryPath)) {
			summaryLines.push(`Global memory: ${memoryFiles.globalMemoryPath}`)
		}
		if (memoryFiles.projectMemoryPath && (await fileExistsAtPath(memoryFiles.projectMemoryPath))) {
			summaryLines.push(`Project memory: ${memoryFiles.projectMemoryPath}`)
		}
		summaryLines.push(`Changes: ${operationSummary}`)

		const contextCondense: ContextCondense = {
			summary: summaryLines.join("\n"),
			cost,
			newContextTokens: 0,
			prevContextTokens: 0,
		}

		if (currentTask) {
			await currentTask.say(
				"save_memory",
				undefined,
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
				contextCondense,
			)
		}

		await provider.postMessageToWebview({
			type: "savedMemory",
			success: true,
			text: `Memory updated (cost: $${cost.toFixed(4)})`,
		})
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)

		if (currentTask) {
			await currentTask.say(
				"save_memory_error",
				"Failed to save memory.",
				undefined,
				false,
				undefined,
				undefined,
				{ isNonInteractive: true },
			)
		}

		await provider.postMessageToWebview({
			type: "savedMemory",
			success: false,
			text: `Memory save failed: ${errorMessage}`,
		})
	}

}
