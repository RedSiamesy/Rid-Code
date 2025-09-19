import { OpenAIToolDefinition } from "./types"

export function getAskFollowupQuestionDescription(): string {
	return `## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively.

Parameters:
- question: (required) A clear, specific question addressing the information needed
- follow_up: (required) A list of 2-4 suggested answers, each in its own <suggest> tag. Suggestions must be complete, actionable answers without placeholders. Optionally include mode attribute to switch modes (code/architect/etc.)

Usage:
<ask_followup_question>
<question>Your question here</question>
<follow_up>
<suggest>First suggestion</suggest>
<suggest mode="code">Action with mode switch</suggest>
</follow_up>
</ask_followup_question>

Example:
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
<follow_up>
<suggest>./src/frontend-config.json</suggest>
<suggest>./config/frontend-config.json</suggest>
<suggest>./frontend-config.json</suggest>
</follow_up>
</ask_followup_question>`
}

export function getAskFollowupQuestionOpenAIToolDefinition(): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "ask_followup_question",
			description: "Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively.",
			parameters: {
				type: "object",
				properties: {
					question: {
						type: "string",
						description: "A clear, specific question addressing the information needed"
					},
					follow_up: {
						type: "array",
						description: "A list of 2-4 suggested answers. Suggestions must be complete, actionable answers without placeholders. Each suggestion can optionally include a mode attribute to switch modes.",
						items: {
							type: "string",
							description: "A suggested answer, optionally with mode attribute (e.g., 'Answer text' or 'Answer text mode=\"code\"')"
						}
					}
				},
				required: ["question", "follow_up"]
			}
		}
	}
}