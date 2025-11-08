import { ToolArgs, OpenAIToolDefinition } from "./types"

export function getWebSearchDescription(args: ToolArgs): string {
	return `## web_search
Description: Create a web search sub-agent that will search for the context information you need on the internet. Please describe your current task requirements in detail to help the sub-agent conduct a better web search.
Parameters:
- task: (required) The search task to execute. Should be a detailed description that includes context about the current task, what information is needed, and any specific requirements.

Usage:
<web_search>
<task>search task here</task>
</web_search>

Example: Search for recent TypeScript best practices
<web_search>
<task>TypeScript 5.0 best practices for large scale applications 2024</task>
</web_search>

Note: The task should be comprehensive and include relevant context for better search results.`
}

const description = `
Create a web search sub-agent that will search for the context information you need on the internet. Please describe your current task requirements in detail to help the sub-agent conduct a better web search. 
The more detailed the task description, the better, possibly including important technical routes and frameworks, constraints and conventions, and other information.
`

export function getWebSearchOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "web_search",
			description,
			parameters: {
				type: "object",
				properties: {
					task: {
						type: "string",
						description: "The search task to execute. Should be a detailed description that includes context about the current task, what information is needed, and any specific requirements."
					}
				},
				required: ["task"]
			}
		}
	}
}