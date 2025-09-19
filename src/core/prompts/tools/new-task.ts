import { ToolArgs, OpenAIToolDefinition } from "./types"

/**
 * Prompt when todos are NOT required (default)
 */
const PROMPT_WITHOUT_TODOS = `## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message.

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement a new feature for the application</message>
</new_task>
`

/**
 * Prompt when todos ARE required
 */
const PROMPT_WITH_TODOS = `## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message and initial todo list.

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.
- todos: (required) The initial todo list in markdown checklist format for the new task.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
<todos>
[ ] First task to complete
[ ] Second task to complete
[ ] Third task to complete
</todos>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement user authentication</message>
<todos>
[ ] Set up auth middleware
[ ] Create login endpoint
[ ] Add session management
[ ] Write tests
</todos>
</new_task>

`



export function getNewTaskDescription(args: ToolArgs): string {
	const todosRequired = args.settings?.newTaskRequireTodos === true

	// Simply return the appropriate prompt based on the setting
	return todosRequired ? PROMPT_WITH_TODOS : PROMPT_WITHOUT_TODOS
}



















const description = `
Usage notes:
1. Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses
2. When the agent is done, it will return a single message back to you. 
3. Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
4. Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent
5. If the agent description mentions that it should be used proactively, then you should try your best to use it without the user having to ask for it first. Use your judgement.
`



export function getNewTaskOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	const todosRequired = args.settings?.newTaskRequireTodos === true

	const properties: Record<string, any> = {
		mode: {
			type: "string",
			description: "The slug of the mode to start the new task in (e.g., 'code', 'debug', 'architect')"
		},
		message: {
			type: "string",
			description: "The initial user message or instructions for this new task"
		}
	}

	const required = ["mode", "message"]

	if (todosRequired) {
		properties.todos = {
			type: "array",
			description: "The initial todo list as an array of strings for the new task",
			items: {
				type: "string",
				description: "A todo item describing a task to complete"
			}
		}
		required.push("todos")
	}

	return {
		type: "function",
		function: {
			name: "new_task",
			description: todosRequired
				? "Creates a new task instance in the chosen mode using your provided message and initial todo list." + description
				: "Creates a new task instance in the chosen mode using your provided message." + description,
			parameters: {
				type: "object",
				properties,
				required
			}
		}
	}
}