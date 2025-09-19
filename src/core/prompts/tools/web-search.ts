import { ToolArgs, OpenAIToolDefinition } from "./types"

export function getWebSearchDescription(args: ToolArgs): string {
	return `## web_search
Description: Search the web for information using a search query. This tool provides comprehensive search results from the internet.
Parameters:
- query: (required) The search query to execute. Should be a detailed description that includes context about the current task, what information is needed, and any specific requirements.

Usage:
<web_search>
<query>search query here</query>
</web_search>

Example: Search for recent TypeScript best practices
<web_search>
<query>TypeScript 5.0 best practices for large scale applications 2024</query>
</web_search>

Note: The query should be comprehensive and include relevant context for better search results.`
}

export function getWebSearchOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "web_search",
			description: "Search the web for information using a search query. This tool provides comprehensive search results from the internet.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "The search query to execute. Should be a detailed description that includes context about the current task, what information is needed, and any specific requirements. (e.g. \"TypeScript 5.0 best practices for large scale applications 2024\")"
					}
				},
				required: ["query"]
			}
		}
	}
}