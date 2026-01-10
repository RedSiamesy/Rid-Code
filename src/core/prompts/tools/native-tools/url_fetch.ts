import type OpenAI from "openai"

const URL_FETCH_DESCRIPTION = `Fetch and extract content from a specific URL. This tool can read web pages and convert them to readable markdown format.`

const URL_PARAMETER_DESCRIPTION = `The URL of the web page to fetch and extract content from.`

export default {
	type: "function",
	function: {
		name: "url_fetch",
		description: URL_FETCH_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: URL_PARAMETER_DESCRIPTION,
				},
			},
			required: ["url"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
