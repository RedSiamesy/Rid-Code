import type OpenAI from "openai"

const WEB_SEARCH_DESCRIPTION = `Create a web search sub-agent that will search for the context information you need on the internet. Please describe your current task requirements in detail to help the sub-agent conduct a better web search.`

const TASK_PARAMETER_DESCRIPTION = `The search task to execute. Include context about the current task, what information is needed, and any specific requirements.`

export default {
	type: "function",
	function: {
		name: "web_search",
		description: WEB_SEARCH_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				task: {
					type: "string",
					description: TASK_PARAMETER_DESCRIPTION,
				},
			},
			required: ["task"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
