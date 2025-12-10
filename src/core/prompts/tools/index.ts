import type { ToolName, ModeConfig } from "@roo-code/types"

import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS, DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"
import { Mode, getModeConfig, isToolAllowedForMode, getGroupName } from "../../../shared/modes"

import { ToolArgs, OpenAIToolDefinition } from "./types"
import { getExecuteCommandDescription } from "./execute-command"
import { getReadFileDescription } from "./read-file"
import { getSimpleReadFileDescription } from "./simple-read-file"
import { getFetchInstructionsDescription } from "./fetch-instructions"
import { shouldUseSingleFileRead } from "@roo-code/types"
import { getWriteToFileDescription } from "./write-to-file"
import { getGrepDescription } from "./grep"
import { getGlobDescription } from "./glob"
import { getListFilesDescription } from "./list-files"
import { getInsertContentDescription } from "./insert-content"
import { getSearchAndReplaceDescription } from "./search-and-replace"
import { getListCodeDefinitionNamesDescription } from "./list-code-definition-names"
import { getBrowserActionDescription } from "./browser-action"
import { getAskFollowupQuestionDescription } from "./ask-followup-question"
import { getAttemptCompletionDescription } from "./attempt-completion"
import { getUseMcpToolDescription } from "./use-mcp-tool"
import { getAccessMcpResourceDescription } from "./access-mcp-resource"
import { getSwitchModeDescription } from "./switch-mode"
import { getNewTaskDescription } from "./new-task"
import { getCodebaseSearchDescription } from "./codebase-search"
import { getUpdateTodoListDescription } from "./update-todo-list"
import { getWebSearchDescription } from "./web-search"
import { getUrlFetchDescription } from "./url-fetch"
import { getRunSlashCommandDescription } from "./run-slash-command"
import { getGenerateImageDescription } from "./generate-image"
// import { getThinkingToolDescription } from "./thinking-tool"
import { CodeIndexManager } from "../../../services/code-index/manager"

// Map of tool names to their description functions
const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
	execute_command: (args) => getExecuteCommandDescription(args),
	read_file: (args) => {
		// Check if the current model should use the simplified read_file tool
		const modelId = args.settings?.modelId
		if (modelId && shouldUseSingleFileRead(modelId)) {
			return getSimpleReadFileDescription(args)
		}
		return getReadFileDescription(args)
	},
	fetch_instructions: (args) => getFetchInstructionsDescription(args.settings?.enableMcpServerCreation),
	write_to_file: (args) => getWriteToFileDescription(args),
	glob: (args) => getGlobDescription(args),
	grep: (args) => getGrepDescription(args),
	list_files: (args) => getListFilesDescription(args),
	list_code_definition_names: (args) => getListCodeDefinitionNamesDescription(args),
	browser_action: (args) => getBrowserActionDescription(args),
	ask_followup_question: () => getAskFollowupQuestionDescription(),
	attempt_completion: (args) => getAttemptCompletionDescription(args),
	use_mcp_tool: (args) => getUseMcpToolDescription(args),
	access_mcp_resource: (args) => getAccessMcpResourceDescription(args),
	codebase_search: (args) => getCodebaseSearchDescription(args),
	switch_mode: () => getSwitchModeDescription(),
	new_task: (args) => getNewTaskDescription(args),
	insert_content: (args) => getInsertContentDescription(args),
	search_and_replace: (args) => getSearchAndReplaceDescription(args),
	apply_diff: (args) =>
		args.diffStrategy ? args.diffStrategy.getToolDescription({ cwd: args.cwd, toolOptions: args.toolOptions }) : "",
	update_todo_list: (args) => getUpdateTodoListDescription(args),
	web_search: (args) => getWebSearchDescription(args),
	url_fetch: (args) => getUrlFetchDescription(args),
	run_slash_command: () => getRunSlashCommandDescription(),
	generate_image: (args) => getGenerateImageDescription(args),
	// thinking_tool: (args) => getThinkingToolDescription(args),
}

export function getToolDescriptionsForMode(
	mode: Mode,
	cwd: string,
	supportsComputerUse: boolean,
	codeIndexManager?: CodeIndexManager,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mcpHub?: McpHub,
	customModes?: ModeConfig[],
	experiments?: Record<string, boolean>,
	partialReadsEnabled?: boolean,
	settings?: Record<string, any>,
	enableMcpServerCreation?: boolean,
	modelId?: string,
): string {
	const config = getModeConfig(mode, customModes)
	const args: ToolArgs = {
		cwd,
		supportsComputerUse,
		diffStrategy,
		browserViewportSize,
		mcpHub,
		partialReadsEnabled,
		settings: {
			...settings,
			enableMcpServerCreation,
			modelId,
		},
		experiments,
	}

	const tools = new Set<string>()

	// Add tools from mode's groups
	config.groups.forEach((groupEntry) => {
		const groupName = getGroupName(groupEntry)
		const toolGroup = TOOL_GROUPS[groupName]
		if (toolGroup) {
			toolGroup.tools.forEach((tool) => {
				if (
					isToolAllowedForMode(
						tool as ToolName,
						mode,
						customModes ?? [],
						undefined,
						undefined,
						experiments ?? {},
					)
				) {
					tools.add(tool)
				}
			})
		}
	})

	// Add always available tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	// Conditionally exclude codebase_search if feature is disabled or not configured
	if (
		!codeIndexManager ||
		!(codeIndexManager.isFeatureEnabled && codeIndexManager.isFeatureConfigured && codeIndexManager.isInitialized)
	) {
		tools.delete("codebase_search")
	}

	// Conditionally exclude update_todo_list if disabled in settings
	if (settings?.todoListEnabled === false) {
		tools.delete("update_todo_list")
	}

	// Conditionally exclude generate_image if experiment is not enabled
	if (!experiments?.imageGeneration) {
		tools.delete("generate_image")
	}

	// Conditionally exclude run_slash_command if experiment is not enabled
	if (!experiments?.runSlashCommand) {
		tools.delete("run_slash_command")
	}

	// Conditionally exclude thinking_tool if tool is not enabled
	// if (!settings?.thinkingToolEnabled) {
	// 	tools.delete("thinking_tool")
	// }

	// Tool names in the specified order
	const toolNames = [
		"attempt_completion",
		"update_todo_list",
		"glob",
		"grep",
		"codebase_search",
		"list_code_definition_names",
		"read_file",
		"apply_diff",
		"insert_content",
		"search_and_replace",
		"write_to_file",
		"new_task",
		"ask_followup_question",
		"execute_command",
		"web_search",
		"url_fetch",
		"browser_action",
		"use_mcp_tool",
		"access_mcp_resource",
		// "switch_mode", 
		"list_files",
		"run_slash_command",
		"generate_image",
		"thinking_tool",
		// "fetch_instructions"
	];

	// Sort tools according to the specified order
	const sortedTools = toolNames.filter(toolName => tools.has(toolName));

	// Map tool descriptions for allowed tools
	const descriptions = sortedTools.map((toolName) => {
		const descriptionFn = toolDescriptionMap[toolName]
		if (!descriptionFn) {
			return undefined
		}

		return descriptionFn({
			...args,
			toolOptions: undefined, // No tool options in group-based approach
		})
	})

	return `====\n\n TOOLS\n\n# Tools\n\n${descriptions.filter(Boolean).join("\n\n")}`
}

// Export individual description functions for backward compatibility
export {
	getExecuteCommandDescription,
	getReadFileDescription,
	getSimpleReadFileDescription,
	getFetchInstructionsDescription,
	getWriteToFileDescription,
	getGrepDescription,
	getListFilesDescription,
	getListCodeDefinitionNamesDescription,
	getBrowserActionDescription,
	getAskFollowupQuestionDescription,
	getAttemptCompletionDescription,
	getUseMcpToolDescription,
	getAccessMcpResourceDescription,
	getSwitchModeDescription,
	getInsertContentDescription,
	getSearchAndReplaceDescription,
	getRunSlashCommandDescription,
	getGenerateImageDescription,
	getCodebaseSearchDescription,
	// getThinkingToolDescription,
}





































// OpenAI tool definition imports
import { getReadFileOpenAIToolDefinition } from "./read-file"
import { getWriteToFileOpenAIToolDefinition } from "./write-to-file"
import { getExecuteCommandOpenAIToolDefinition } from "./execute-command"
import { getGlobOpenAIToolDefinition } from "./glob"
import { getGrepOpenAIToolDefinition } from "./grep"
import { getListFilesOpenAIToolDefinition } from "./list-files"
import { getListCodeDefinitionNamesOpenAIToolDefinition } from "./list-code-definition-names"
import { getInsertContentOpenAIToolDefinition } from "./insert-content"
import { getSearchAndReplaceOpenAIToolDefinition } from "./search-and-replace"
import { getAttemptCompletionOpenAIToolDefinition } from "./attempt-completion"
import { getNewTaskOpenAIToolDefinition } from "./new-task"
import { getUpdateTodoListOpenAIToolDefinition } from "./update-todo-list"
import { getApplyDiffOpenAIToolDefinition } from "./apply-diff-riddler"
import { getCodebaseSearchOpenAIToolDefinition } from "./codebase-search"
import { getWebSearchOpenAIToolDefinition } from "./web-search"
import { getUrlFetchOpenAIToolDefinition } from "./url-fetch"
// import { getUseMcpToolOpenAIToolDefinition } from "./use-mcp-tool"
import { getSwitchModeOpenAIToolDefinition } from "./switch-mode"
import { getSimpleReadFileOpenAIToolDefinition } from "./simple-read-file"
import { getRunSlashCommandOpenAIToolDefinition } from "./run-slash-command"
import { getGenerateImageOpenAIToolDefinition } from "./generate-image"
import { getFetchInstructionsOpenAIToolDefinition } from "./fetch-instructions"
// import { getThinkingToolOpenAIToolDefinition } from "./thinking-tool"
import { getBrowserActionOpenAIToolDefinition } from "./browser-action"
import { getAskFollowupQuestionOpenAIToolDefinition } from "./ask-followup-question"
import { getAccessMcpResourceOpenAIToolDefinition } from "./access-mcp-resource"

// Conversion functions imports
import {
	convertReadFileArgsToXml,
	convertUpdateTodoListToXml,
	convertApplyDiffToXml,
	convertAskFollowUpQuestionToXml,
	convertOpenAIToolCallToMcp,
} from "./tool-convert-riddler"

// Map of tool names to their OpenAI tool definition functions
const openAIToolDefinitionMap: Record<string, (args: ToolArgs) => any> = {
	execute_command: (args) => getExecuteCommandOpenAIToolDefinition(args),
	read_file: (args) => {
		// Check if the current model should use the simplified read_file tool
		const modelId = args.settings?.modelId
		if (modelId && shouldUseSingleFileRead(modelId)) {
			return getSimpleReadFileOpenAIToolDefinition(args)
		}
		return getReadFileOpenAIToolDefinition(args)
	},
	fetch_instructions: (args) => getFetchInstructionsOpenAIToolDefinition(args.settings?.enableMcpServerCreation),
	write_to_file: (args) => getWriteToFileOpenAIToolDefinition(args),
	glob: (args) => getGlobOpenAIToolDefinition(args),
	grep: (args) => getGrepOpenAIToolDefinition(args),
	list_files: (args) => getListFilesOpenAIToolDefinition(args),
	list_code_definition_names: (args) => getListCodeDefinitionNamesOpenAIToolDefinition(args),
	browser_action: (args) => getBrowserActionOpenAIToolDefinition(args),
	ask_followup_question: () => getAskFollowupQuestionOpenAIToolDefinition(),
	attempt_completion: (args) => getAttemptCompletionOpenAIToolDefinition(args),
	// use_mcp_tool: (args) => getUseMcpToolOpenAIToolDefinition(args),
	access_mcp_resource: (args) => getAccessMcpResourceOpenAIToolDefinition(args),
	codebase_search: (args) => getCodebaseSearchOpenAIToolDefinition(args),
	switch_mode: () => getSwitchModeOpenAIToolDefinition(),
	new_task: (args) => getNewTaskOpenAIToolDefinition(args),
	insert_content: (args) => getInsertContentOpenAIToolDefinition(args),
	search_and_replace: (args) => getSearchAndReplaceOpenAIToolDefinition(args),
	apply_diff: (args) => getApplyDiffOpenAIToolDefinition(args),
	update_todo_list: (args) => getUpdateTodoListOpenAIToolDefinition(args),
	run_slash_command: () => getRunSlashCommandOpenAIToolDefinition(),
	generate_image: (args) => getGenerateImageOpenAIToolDefinition(args),
	// thinking_tool: (args) => getThinkingToolOpenAIToolDefinition(args),
	web_search: (args) => getWebSearchOpenAIToolDefinition(args),
	url_fetch: (args) => getUrlFetchOpenAIToolDefinition(args),
}



/**
 * Get OpenAI tool definitions for a given mode
 */
export function getOpenAIToolDefinitionsForMode(
	mode: Mode,
	cwd: string,
	supportsComputerUse: boolean,
	codeIndexManager?: CodeIndexManager,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mcpHub?: McpHub,
	customModes?: ModeConfig[],
	experiments?: Record<string, boolean>,
	partialReadsEnabled?: boolean,
	settings?: Record<string, any>,
	enableMcpServerCreation?: boolean,
	modelId?: string,
): OpenAIToolDefinition[] {
	const config = getModeConfig(mode, customModes)
	const args: ToolArgs = {
		cwd,
		supportsComputerUse,
		diffStrategy,
		browserViewportSize,
		mcpHub,
		partialReadsEnabled,
		settings: {
			...settings,
			enableMcpServerCreation,
			modelId,
		},
		experiments,
	}

	const tools = new Set<string>()

	// Add tools from mode's groups
	config.groups.forEach((groupEntry) => {
		const groupName = getGroupName(groupEntry)
		const toolGroup = TOOL_GROUPS[groupName]
		if (toolGroup) {
			toolGroup.tools.forEach((tool) => {
				if (
					isToolAllowedForMode(
						tool as ToolName,
						mode,
						customModes ?? [],
						undefined,
						undefined,
						experiments ?? {},
					)
				) {
					tools.add(tool)
				}
			})
		}
	})

	// Add always available tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	// Conditionally exclude codebase_search if feature is disabled or not configured
	if (
		!codeIndexManager ||
		!(codeIndexManager.isFeatureEnabled && codeIndexManager.isFeatureConfigured && codeIndexManager.isInitialized)
	) {
		tools.delete("codebase_search")
	}

	// Conditionally exclude update_todo_list if disabled in settings
	if (settings?.todoListEnabled === false) {
		tools.delete("update_todo_list")
	}

	// Conditionally exclude generate_image if experiment is not enabled
	if (!experiments?.imageGeneration) {
		tools.delete("generate_image")
	}

	// Conditionally exclude run_slash_command if experiment is not enabled
	if (!experiments?.runSlashCommand) {
		tools.delete("run_slash_command")
	}

	// Conditionally exclude thinking_tool if tool is not enabled
	// if (!settings?.thinkingToolEnabled) {
	// 	tools.delete("thinking_tool")
	// }

	// Tool names in the specified order
	const toolNames = [
		"attempt_completion",
		"update_todo_list",
		"glob",
		"grep",
		"codebase_search",
		"list_code_definition_names",
		"read_file",
		"apply_diff",
		"insert_content",
		"search_and_replace",
		"write_to_file",
		"new_task",
		"ask_followup_question",
		"execute_command",
		"web_search",
		"url_fetch",
		"browser_action",
		"use_mcp_tool",
		"access_mcp_resource",
		// "switch_mode",
		"list_files",
		"run_slash_command",
		"generate_image",
		"thinking_tool",
		// "fetch_instructions"
	];

	// Sort tools according to the specified order
	const sortedTools = toolNames.filter(toolName => tools.has(toolName));

	// Map OpenAI tool definitions for allowed tools
	const definitions = sortedTools.map((toolName) => {
		const definitionFn = openAIToolDefinitionMap[toolName]
		if (!definitionFn) {
			return undefined
		}

		return definitionFn({
			...args,
			toolOptions: undefined, // No tool options in group-based approach
		})
	})

	return definitions.filter(Boolean)
}


// Export OpenAI tool definition functions
export {
	getReadFileOpenAIToolDefinition,
	getWriteToFileOpenAIToolDefinition,
	getExecuteCommandOpenAIToolDefinition,
	getGlobOpenAIToolDefinition,
	getGrepOpenAIToolDefinition,
	getListFilesOpenAIToolDefinition,
	getListCodeDefinitionNamesOpenAIToolDefinition,
	getInsertContentOpenAIToolDefinition,
	getSearchAndReplaceOpenAIToolDefinition,
	getAttemptCompletionOpenAIToolDefinition,
	getNewTaskOpenAIToolDefinition,
	getUpdateTodoListOpenAIToolDefinition,
	getApplyDiffOpenAIToolDefinition,
	getCodebaseSearchOpenAIToolDefinition,
	getWebSearchOpenAIToolDefinition,
	getUrlFetchOpenAIToolDefinition,
	// getUseMcpToolOpenAIToolDefinition,
	getSwitchModeOpenAIToolDefinition,
	getSimpleReadFileOpenAIToolDefinition,
	getRunSlashCommandOpenAIToolDefinition,
	getGenerateImageOpenAIToolDefinition,
	getFetchInstructionsOpenAIToolDefinition,
	getBrowserActionOpenAIToolDefinition,
	getAskFollowupQuestionOpenAIToolDefinition,
	getAccessMcpResourceOpenAIToolDefinition,
	// getThinkingToolOpenAIToolDefinition,
}

// Export conversion functions
export {
	convertReadFileArgsToXml,
	convertUpdateTodoListToXml,
	convertApplyDiffToXml,
	convertAskFollowUpQuestionToXml,
	convertOpenAIToolCallToMcp,
}
