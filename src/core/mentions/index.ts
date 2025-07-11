import fs from "fs/promises"
import * as path from "path"

import * as vscode from "vscode"
import { isBinaryFile } from "isbinaryfile"

import { mentionRegexGlobal, unescapeSpaces } from "../../shared/context-mentions"

import { getCommitInfo, getWorkingState } from "../../utils/git"
import { getWorkspacePath } from "../../utils/path"
import { fileExistsAtPath } from "../../utils/fs"

import { openFile } from "../../integrations/misc/open-file"
import { extractTextFromFile } from "../../integrations/misc/extract-text"
import { diagnosticsToProblemsString } from "../../integrations/diagnostics"

import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"

import { FileContextTracker } from "../context-tracking/FileContextTracker"

import { RooIgnoreController } from "../ignore/RooIgnoreController"

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

export async function openMention(mention?: string): Promise<void> {
	if (!mention) {
		return
	}

	const cwd = getWorkspacePath()
	if (!cwd) {
		return
	}

	if (mention.startsWith("/")) {
		// Slice off the leading slash and unescape any spaces in the path
		const relPath = unescapeSpaces(mention.slice(1))
		const absPath = path.resolve(cwd, relPath)
		if (mention.endsWith("/")) {
			vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(absPath))
		} else {
			openFile(absPath)
		}
	} else if (mention === "problems") {
		vscode.commands.executeCommand("workbench.actions.view.problems")
	} else if (mention === "terminal") {
		vscode.commands.executeCommand("workbench.action.terminal.focus")
	} else if (mention.startsWith("http")) {
		vscode.env.openExternal(vscode.Uri.parse(mention))
	}
}

export async function parseMentions(
	text: string,
	cwd: string,
	urlContentFetcher: UrlContentFetcher,
	fileContextTracker?: FileContextTracker,
	rooIgnoreController?: RooIgnoreController,
	showRooIgnoredFiles: boolean = true,
	globalStoragePath?: string,
): Promise<string> {
	const mentions: Set<string> = new Set()
	let parsedText = text.replace(mentionRegexGlobal, (match, mention) => {
		mentions.add(mention)
		if (mention.startsWith("http")) {
			return `'${mention}' (see below for site content)`
		} else if (mention.startsWith("/")) {
			const mentionPath = mention.slice(1)
			return mentionPath.endsWith("/")
				? `'${mentionPath}' (see below for folder content)`
				: `'${mentionPath}' (see below for file content)`
		} else if (mention === "problems") {
			return `Workspace Problems (see below for diagnostics)`
		} else if (mention === "git-changes") {
			return `Working directory changes (see below for details)`
		} else if (/^[a-f0-9]{7,40}$/.test(mention)) {
			return `Git commit '${mention}' (see below for commit info)`
		} else if (mention === "terminal") {
			return `Terminal Output (see below for output)`
		} else if (mention.startsWith("codebase")) {
			if (mention.includes(":")) {
				const path = mention.slice(9)
				return `As the first step, use the 'codebase_search' tool to search for relevant information needed for the task, using "${path}" as the search path.`
			}
			return "As the first step, use the 'codebase_search' tool to search for relevant information needed for the task."
		} else if (mention.startsWith("summary")) {
			if (mention.includes(":")) {
				const path = mention.slice(8)
				return `As the first step, use the 'codebase_search' tool to get a summary for '${path}'.`
			}
			return "As the first step, use the 'codebase_search' tool to get a summary of the relevant information needed for the task."
		} else if (mention.startsWith("memory")) {
			if (globalStoragePath) {
				return "Memory (see below for stored memory)"
			} else {
				return "Memory (global storage path not available)"
			}
		}
		return match
	})

	const urlMention = Array.from(mentions).find((mention) => mention.startsWith("http"))
	let launchBrowserError: Error | undefined
	if (urlMention) {
		try {
			await urlContentFetcher.launchBrowser()
		} catch (error) {
			launchBrowserError = error
			vscode.window.showErrorMessage(`Error fetching content for ${urlMention}: ${error.message}`)
		}
	}

	for (const mention of mentions) {
		if (mention.startsWith("http")) {
			let result: string
			if (launchBrowserError) {
				result = `Error fetching content: ${launchBrowserError.message}`
			} else {
				try {
					const markdown = await urlContentFetcher.urlToMarkdown(mention)
					result = markdown
				} catch (error) {
					vscode.window.showErrorMessage(`Error fetching content for ${mention}: ${error.message}`)
					result = `Error fetching content: ${error.message}`
				}
			}
			parsedText += `\n\n<url_content url="${mention}">\n${result}\n</url_content>`
		} else if (mention.startsWith("/")) {
			const mentionPath = mention.slice(1)
			try {
				const content = await getFileOrFolderContent(mentionPath, cwd, rooIgnoreController, showRooIgnoredFiles)
				if (mention.endsWith("/")) {
					parsedText += `\n\n<folder_content path="${mentionPath}">\n${content}\n</folder_content>`
				} else {
					parsedText += `\n\n<file_content path="${mentionPath}">\n${content}\n</file_content>`
					if (fileContextTracker) {
						await fileContextTracker.trackFileContext(mentionPath, "file_mentioned")
					}
				}
			} catch (error) {
				if (mention.endsWith("/")) {
					parsedText += `\n\n<folder_content path="${mentionPath}">\nError fetching content: ${error.message}\n</folder_content>`
				} else {
					parsedText += `\n\n<file_content path="${mentionPath}">\nError fetching content: ${error.message}\n</file_content>`
				}
			}
		} else if (mention === "problems") {
			try {
				const problems = await getWorkspaceProblems(cwd)
				parsedText += `\n\n<workspace_diagnostics>\n${problems}\n</workspace_diagnostics>`
			} catch (error) {
				parsedText += `\n\n<workspace_diagnostics>\nError fetching diagnostics: ${error.message}\n</workspace_diagnostics>`
			}
		} else if (mention === "git-changes") {
			try {
				const workingState = await getWorkingState(cwd)
				parsedText += `\n\n<git_working_state>\n${workingState}\n</git_working_state>`
			} catch (error) {
				parsedText += `\n\n<git_working_state>\nError fetching working state: ${error.message}\n</git_working_state>`
			}
		} else if (/^[a-f0-9]{7,40}$/.test(mention)) {
			try {
				const commitInfo = await getCommitInfo(mention, cwd)
				parsedText += `\n\n<git_commit hash="${mention}">\n${commitInfo}\n</git_commit>`
			} catch (error) {
				parsedText += `\n\n<git_commit hash="${mention}">\nError fetching commit info: ${error.message}\n</git_commit>`
			}
		} else if (mention === "terminal") {
			try {
				const terminalOutput = await getLatestTerminalOutput()
				parsedText += `\n\n<terminal_output>\n${terminalOutput}\n</terminal_output>`
			} catch (error) {
				parsedText += `\n\n<terminal_output>\nError fetching terminal output: ${error.message}\n</terminal_output>`
			}
		} else if (mention.startsWith("codebase")) {
			
		} else if (mention.startsWith("summary")) {
			
		} else if (mention.startsWith("memory")) {
			if (globalStoragePath) {
				try {
					const memoryFiles = await getMemoryFilePaths(globalStoragePath)
					const memoryData = await readMemoryFiles(memoryFiles)
					const formattedMemory = formatMemoryContent(memoryData)
					parsedText += `\n\n<agent_memory_content>\n${formattedMemory}\n\n(If there are reminders or to-do items due, please notify the user.)\n</agent_memory_content>`
				} catch (error) {
					parsedText += `\n\n<agent_memory_content>\nError reading memory: ${error.message}\n</agent_memory_content>`
				}
			} else {
				parsedText += `\n\n<agent_memory_content>\nError: Memory path not available\n</agent_memory_content>`
			}
		}
	}

	if (urlMention) {
		try {
			await urlContentFetcher.closeBrowser()
		} catch (error) {
			console.error(`Error closing browser: ${error.message}`)
		}
	}

	return parsedText
}

async function getFileOrFolderContent(
	mentionPath: string,
	cwd: string,
	rooIgnoreController?: any,
	showRooIgnoredFiles: boolean = true,
): Promise<string> {
	const unescapedPath = unescapeSpaces(mentionPath)
	const absPath = path.resolve(cwd, unescapedPath)

	try {
		const stats = await fs.stat(absPath)

		if (stats.isFile()) {
			if (rooIgnoreController && !rooIgnoreController.validateAccess(absPath)) {
				return `(File ${mentionPath} is ignored by .rooignore)`
			}
			try {
				const content = await extractTextFromFile(absPath)
				return content
			} catch (error) {
				return `(Failed to read contents of ${mentionPath}): ${error.message}`
			}
		} else if (stats.isDirectory()) {
			const entries = await fs.readdir(absPath, { withFileTypes: true })
			let folderContent = ""
			const fileContentPromises: Promise<string | undefined>[] = []
			const LOCK_SYMBOL = "🔒"

			for (let index = 0; index < entries.length; index++) {
				const entry = entries[index]
				const isLast = index === entries.length - 1
				const linePrefix = isLast ? "└── " : "├── "
				const entryPath = path.join(absPath, entry.name)

				let isIgnored = false
				if (rooIgnoreController) {
					isIgnored = !rooIgnoreController.validateAccess(entryPath)
				}

				if (isIgnored && !showRooIgnoredFiles) {
					continue
				}

				const displayName = isIgnored ? `${LOCK_SYMBOL} ${entry.name}` : entry.name

				if (entry.isFile()) {
					folderContent += `${linePrefix}${displayName}\n`
					if (!isIgnored) {
						const filePath = path.join(mentionPath, entry.name)
						const absoluteFilePath = path.resolve(absPath, entry.name)
						fileContentPromises.push(
							(async () => {
								try {
									const isBinary = await isBinaryFile(absoluteFilePath).catch(() => false)
									if (isBinary) {
										return undefined
									}
									const content = await extractTextFromFile(absoluteFilePath)
									return `<file_content path="${filePath.toPosix()}">\n${content}\n</file_content>`
								} catch (error) {
									return undefined
								}
							})(),
						)
					}
				} else if (entry.isDirectory()) {
					folderContent += `${linePrefix}${displayName}/\n`
				} else {
					folderContent += `${linePrefix}${displayName}\n`
				}
			}
			const fileContents = (await Promise.all(fileContentPromises)).filter((content) => content)
			return `${folderContent}\n${fileContents.join("\n\n")}`.trim()
		} else {
			return `(Failed to read contents of ${mentionPath})`
		}
	} catch (error) {
		throw new Error(`Failed to access path "${mentionPath}": ${error.message}`)
	}
}

async function getWorkspaceProblems(cwd: string): Promise<string> {
	const diagnostics = vscode.languages.getDiagnostics()
	const result = await diagnosticsToProblemsString(
		diagnostics,
		[vscode.DiagnosticSeverity.Error, vscode.DiagnosticSeverity.Warning],
		cwd,
	)
	if (!result) {
		return "No errors or warnings detected."
	}
	return result
}

/**
 * Gets the contents of the active terminal
 * @returns The terminal contents as a string
 */
export async function getLatestTerminalOutput(): Promise<string> {
	// Store original clipboard content to restore later
	const originalClipboard = await vscode.env.clipboard.readText()

	try {
		// Select terminal content
		await vscode.commands.executeCommand("workbench.action.terminal.selectAll")

		// Copy selection to clipboard
		await vscode.commands.executeCommand("workbench.action.terminal.copySelection")

		// Clear the selection
		await vscode.commands.executeCommand("workbench.action.terminal.clearSelection")

		// Get terminal contents from clipboard
		let terminalContents = (await vscode.env.clipboard.readText()).trim()

		// Check if there's actually a terminal open
		if (terminalContents === originalClipboard) {
			return ""
		}

		// Clean up command separation
		const lines = terminalContents.split("\n")
		const lastLine = lines.pop()?.trim()

		if (lastLine) {
			let i = lines.length - 1

			while (i >= 0 && !lines[i].trim().startsWith(lastLine)) {
				i--
			}

			terminalContents = lines.slice(Math.max(i, 0)).join("\n")
		}

		return terminalContents
	} finally {
		// Restore original clipboard content
		await vscode.env.clipboard.writeText(originalClipboard)
	}
}

// Export processUserContentMentions from its own file
export { processUserContentMentions } from "./processUserContentMentions"
