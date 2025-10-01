import { ToolArgs, OpenAIToolDefinition } from "./types"

export function getThinkingToolDescription(args: ToolArgs): string {
	return `## thinking_tool
Description: Invoke this tool after completing a milestone, finishing a task on your to-do list, or when starting a task, dealing with a difficult and complex problem. It is designed to facilitate in-depth reflection and analysis of the current situation, helping you to avoid overlooking details and to generate new ideas or approaches.
Parameters: No parameters required

Usage:
<thinking_tool>
</thinking_tool>`
}

export function getThinkingToolOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "thinking_tool",
			description: "Invoke this tool after completing a milestone, finishing a task on your to-do list, or when starting a task, dealing with a difficult and complex problem. It is designed to facilitate in-depth reflection and analysis of the current situation, helping you to avoid overlooking details and to generate new ideas or approaches.",
			parameters: {
				type: "object",
				properties: {},
				required: []
			}
		}
	}
}