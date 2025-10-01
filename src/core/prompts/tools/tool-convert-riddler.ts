/**
 * Common utility functions for converting OpenAI tool calls to XML format
 */

/**
 * Escape XML special characters in a string
 */
export function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/**
 * Parse OpenAI tool call arguments (handles both string and object formats)
 */
export function parseToolArgs(toolCall: any): any {
	const args = toolCall.function.arguments
	if (typeof args === 'string') {
		return JSON.parse(args)
	}
	return args
}

/**
 * Generate XML for simple key-value parameters
 */
export function generateSimpleParamsXml(params: Record<string, any>, exclude: string[] = []): string {
	return Object.entries(params)
		.filter(([key]) => !exclude.includes(key))
		.map(([key, value]) => {
			if (value === null || value === undefined) {
				return ''
			}
			const escapedValue = typeof value === 'string' ? escapeXml(value) : value
			return `<${key}>${escapedValue}</${key}>`
		})
		.filter(Boolean)
		.join('\n')
}

/**
 * Generate XML for array parameters
 */
export function generateArrayParamsXml(params: Record<string, any>, arrayKeys: string[]): string {
	return arrayKeys
		.filter(key => params[key] && Array.isArray(params[key]))
		.map(key => {
			const items = params[key].map((item: any) => {
				const escapedItem = typeof item === 'string' ? escapeXml(item) : item
				return `${escapedItem}`
			}).join('\n')
			return `<${key}>
${items}
</${key}>`
		})
		.join('\n')
}























// Individual tool conversion functions
export function convertReadFileArgsToXml(files: any): string {
	// Multiple files format
	const filesContent = files.map((file: any) => {
		const fileParams = generateSimpleParamsXml(file, ['path'])
			return `<file>
<path>${escapeXml(file.path)}</path>
${fileParams ? fileParams.replace(/\n/g, '\n') : ''}
</file>`
}).join('\n') || ''
	return filesContent
}









export function convertUpdateTodoListToXml(todos: any): string {
	if (!todos || !todos.length) { return "" }

	const todosContent = todos.map((todo: any) => {
		if (typeof todo==="string") {
			return escapeXml(todo)
		} else if (todo.content && todo.state && typeof todo.content==="string" && typeof todo.state==="string") {
			if (todo.state.toLowerCase() === "completed") {
				return "[x] "+todo.content
			} else if (todo.state.toLowerCase() === "in_progress") {
				return "[-] "+todo.content
			}
			return "[ ] "+todo.content
		}
		return ""
	}).join('\n')
	return todosContent
}

export function convertAskFollowUpQuestionToXml(suggests: any): string {
	if (!suggests || !suggests.length) { return "" }

	const suggestsContent = suggests.map((suggest: string) => `<suggest>${escapeXml(suggest)}</suggest>`).join('\n')
	return suggestsContent
}










export function convertApplyDiffToXml(diffs: any): string {
	const diffBlocks = diffs.map((diff: any) => {
		return `<<<<<<< SEARCH
:start_line: ${diff.start_line}
-------
${diff.src}
=======
${diff.dst}
>>>>>>> REPLACE`
	}).join('\n\n')
	return diffBlocks
}


import { TextContent, ToolUse, ToolParamName, toolParamNames } from "../../../shared/tools"

/**
 * Convert OpenAI tool call to MCP format
 * This function detects if a tool call is for an MCP tool and converts it accordingly
 */
export function convertOpenAIToolCallToMcp(toolCall: any): ToolUse {
	const toolName = toolCall.name || ''

	// Parse the tool name to extract server name and actual tool name
	// Format: _mcp|{server.name}|{tool.name}
	const parts = toolName.split('|')
	if (parts.length !== 3) {
		console.error(`Invalid MCP tool name format: ${toolName}`)
		throw new Error(`Invalid MCP tool name format: ${toolName}`)
	}

	const [, serverName, actualToolName] = parts

	return {
		type: "tool_use",
		name: "use_mcp_tool",
		params: {
				server_name: serverName,
				tool_name: actualToolName,
				arguments: JSON.stringify(toolCall.params || {})
			},
		partial: false,
		tool_call_id: toolCall.tool_call_id || ''
	}
}


