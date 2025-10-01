import * as vscode from "vscode"
import * as os from "os"

import type { ModeConfig, PromptComponent, CustomModePrompts, TodoItem } from "@roo-code/types"

import type { SystemPromptSettings } from "./types"

import { Mode, modes, defaultModeSlug, getModeBySlug, getGroupName, getModeSelection } from "../../shared/modes"
import { DiffStrategy } from "../../shared/tools"
import { formatLanguage } from "../../shared/language"
import { isEmpty } from "../../utils/object"

import { McpHub } from "../../services/mcp/McpHub"
import { CodeIndexManager } from "../../services/code-index/manager"

import { PromptVariables, loadSystemPromptFile } from "./sections/custom-system-prompt"

import { getToolDescriptionsForMode, getOpenAIToolDefinitionsForMode } from "./tools"
import {
	getRulesSection,
	getPersonaSection,
	getSystemInfoSection,
	getObjectiveSection,
	getSharedToolUseSection,
	getMcpServersSection,
	getMcpServersAsTool,
	getToolUseGuidelinesSection,
	getCapabilitiesSection,
	getModesSection,
	addCustomInstructions,
	addLanguagePreferences,
	markdownFormattingSection,
} from "./sections"
import OpenAI from "openai"

// Helper function to get prompt component, filtering out empty objects
export function getPromptComponent(
	customModePrompts: CustomModePrompts | undefined,
	mode: string,
): PromptComponent | undefined {
	const component = customModePrompts?.[mode]
	// Return undefined if component is empty
	if (isEmpty(component)) {
		return undefined
	}
	return component
}

async function generatePrompt(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	// Get the full mode config to ensure we have the role definition (used for groups, etc.)
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModeConfigs)

	// Check if MCP functionality should be included
	const hasMcpGroup = modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
	const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
	const shouldIncludeMcp = hasMcpGroup && hasMcpServers

	const [modesSection, mcpServersSection] = await Promise.all([
		getModesSection(context),
		shouldIncludeMcp
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)
			: Promise.resolve(""),
	])

	const codeIndexManager = CodeIndexManager.getInstance(context, cwd)

	return `${roleDefinition}

${markdownFormattingSection()}

${experiments?.useToolCalling ? "" : getSharedToolUseSection()}

${experiments?.useToolCalling ? "" : getToolDescriptionsForMode(
	mode,
	cwd,
	supportsComputerUse,
	codeIndexManager,
	effectiveDiffStrategy,
	browserViewportSize,
	shouldIncludeMcp ? mcpHub : undefined,
	customModeConfigs,
	experiments,
	partialReadsEnabled,
	settings,
	enableMcpServerCreation,
	modelId,
)}

${getToolUseGuidelinesSection(codeIndexManager, experiments?.allowedMultiCall)}

${experiments?.useToolCalling ? "" : mcpServersSection}

${getCapabilitiesSection(cwd, supportsComputerUse, shouldIncludeMcp ? mcpHub : undefined, effectiveDiffStrategy, codeIndexManager)}

${modesSection}

${getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy, codeIndexManager)}

${getSystemInfoSection(cwd)}

${getObjectiveSection(codeIndexManager, experiments)}

${await addCustomInstructions(baseInstructions, globalCustomInstructions || "", cwd, mode, {
	language: language ?? formatLanguage(vscode.env.language),
	rooIgnoreInstructions,
	settings,
})}

${addLanguagePreferences(language ?? formatLanguage(vscode.env.language),)}
`
}



async function generatePromptWithFileCustomSystemPrompt(
	fileCustomSystemPrompt: string,
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
): Promise<string> {
if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	// Get the full mode config to ensure we have the role definition (used for groups, etc.)
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModeConfigs)

	// Check if MCP functionality should be included
	const hasMcpGroup = modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
	const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
	const shouldIncludeMcp = hasMcpGroup && hasMcpServers

	const [modesSection, mcpServersSection] = await Promise.all([
		getModesSection(context),
		shouldIncludeMcp
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)
			: Promise.resolve(""),
	])

	const codeIndexManager = CodeIndexManager.getInstance(context, cwd)

	return `${roleDefinition}

${fileCustomSystemPrompt}

${await addCustomInstructions(baseInstructions, globalCustomInstructions || "", cwd, mode, {
	rooIgnoreInstructions,
	settings,
})}

${markdownFormattingSection()}

${experiments?.useToolCalling ? "" : getToolDescriptionsForMode(
	mode,
	cwd,
	supportsComputerUse,
	codeIndexManager,
	effectiveDiffStrategy,
	browserViewportSize,
	shouldIncludeMcp ? mcpHub : undefined,
	customModeConfigs,
	experiments,
	partialReadsEnabled,
	settings,
	enableMcpServerCreation,
	modelId,
)}

${experiments?.useToolCalling ? "" : mcpServersSection}

${modesSection}

${addLanguagePreferences(language ?? formatLanguage(vscode.env.language),)}

${getSystemInfoSection(cwd)}
`
}



async function generateCCPrompt(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	// Get the full mode config to ensure we have the role definition (used for groups, etc.)
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModeConfigs)

	// Check if MCP functionality should be included
	const hasMcpGroup = modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
	const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
	const shouldIncludeMcp = hasMcpGroup && hasMcpServers

	const [modesSection, mcpServersSection] = await Promise.all([
		getModesSection(context),
		shouldIncludeMcp
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation, mode)
			: Promise.resolve(""),
	])

	const codeIndexManager = CodeIndexManager.getInstance(context, cwd)

	return `${roleDefinition}

${getPersonaSection()}	

${await addCustomInstructions(baseInstructions, globalCustomInstructions || "", cwd, mode, {
	rooIgnoreInstructions,
	settings,
})}

${markdownFormattingSection()}

${experiments?.useToolCalling ? "" : getToolDescriptionsForMode(
	mode,
	cwd,
	supportsComputerUse,
	codeIndexManager,
	effectiveDiffStrategy,
	browserViewportSize,
	shouldIncludeMcp ? mcpHub : undefined,
	customModeConfigs,
	experiments,
	partialReadsEnabled,
	settings,
	enableMcpServerCreation,
	modelId,
)}

${experiments?.useToolCalling ? "" : mcpServersSection}

${modesSection}

${addLanguagePreferences(language ?? formatLanguage(vscode.env.language),)}

${getSystemInfoSection(cwd)}
`
}



















export const SYSTEM_PROMPT = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mode: Mode = defaultModeSlug,
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// Try to load custom system prompt from file
	const variablesForPrompt: PromptVariables = {
		workspace: cwd,
		mode: mode,
		language: language ?? formatLanguage(vscode.env.language),
		shell: vscode.env.shell,
		operatingSystem: os.type(),
	}
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)

	// Check if it's a custom mode
	const promptComponent = getPromptComponent(customModePrompts, mode)

	// Get full mode config from custom modes or fall back to built-in modes
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	// 根据实验性选项选择使用哪个提示生成函数
	const useNativePrompt = experiments?.useNativePrompt ?? false
	
	// If a file-based custom system prompt exists, use it
	if (fileCustomSystemPrompt) {
		return generatePromptWithFileCustomSystemPrompt(
			fileCustomSystemPrompt,
			context,
			cwd,
			supportsComputerUse,
			currentMode.slug,
			mcpHub,
			effectiveDiffStrategy,
			browserViewportSize,
			promptComponent,
			customModes,
			globalCustomInstructions,
			diffEnabled,
			experiments,
			enableMcpServerCreation,
			language,
			rooIgnoreInstructions,
			partialReadsEnabled,
			settings,
			todoList,
			modelId,
		)
	} else if (useNativePrompt) {
		return generatePrompt(
			context,
			cwd,
			supportsComputerUse,
			currentMode.slug,
			mcpHub,
			effectiveDiffStrategy,
			browserViewportSize,
			promptComponent,
			customModes,
			globalCustomInstructions,
			diffEnabled,
			experiments,
			enableMcpServerCreation,
			language,
			rooIgnoreInstructions,
			partialReadsEnabled,
			settings,
			todoList,
			modelId,
		)
	} else {
		return generateCCPrompt(
			context,
			cwd,
			supportsComputerUse,
			currentMode.slug,
			mcpHub,
			effectiveDiffStrategy,
			browserViewportSize,
			promptComponent,
			customModes,
			globalCustomInstructions,
			diffEnabled,
			experiments,
			enableMcpServerCreation,
			language,
			rooIgnoreInstructions,
			partialReadsEnabled,
			settings,
			todoList,
			modelId,
		)
	}
}












/**
 * Get OpenAI tool definitions for a given mode (similar to SYSTEM_PROMPT but for tools)
 */
export const OPENAI_TOOLS_LIST = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mode: Mode = defaultModeSlug,
	customModes?: ModeConfig[],
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	modelId?: string,
): Promise<OpenAI.ChatCompletionTool[]> => {
	const codeIndexManager = CodeIndexManager.getInstance(context, cwd)

	// If diff is disabled, don't pass the diffStrategy (same logic as SYSTEM_PROMPT)
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	const mcpTools = await getMcpServersAsTool(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)

	const systemTools = getOpenAIToolDefinitionsForMode(
		mode,
		cwd,
		supportsComputerUse,
		codeIndexManager,
		effectiveDiffStrategy,
		browserViewportSize,
		mcpHub,
		customModes,
		experiments,
		partialReadsEnabled,
		settings,
		enableMcpServerCreation,
		modelId,
	)

	return [...systemTools, ...mcpTools]
}
