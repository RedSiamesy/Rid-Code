import { ToolArgs } from "./types"

export function getNewTaskDescription(_args: ToolArgs): string {
	return `## sub_agent
Description: This will let you create a sub agent instance in the chosen mode using your provided message.

Parameters:
- mode: (required) The slug of the mode to start the sub agent in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this sub agent.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
</new_task>
`
}
