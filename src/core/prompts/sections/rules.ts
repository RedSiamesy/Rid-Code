import { DiffStrategy } from "../../../shared/tools"

import { ModeConfig } from "../../../shared/modes"

function getEditingInstructions(diffStrategy?: DiffStrategy): string {
	const instructions: string[] = []
	const availableTools: string[] = []

	// Collect available editing tools
	if (diffStrategy) {
		availableTools.push(
			"apply_diff (for replacing lines in existing files)",
			"write_to_file (for creating new files or complete file rewrites)",
		)
	} else {
		availableTools.push("write_to_file (for creating new files or complete file rewrites)")
	}

	availableTools.push("insert_content (for adding lines to existing files)")
	availableTools.push("search_and_replace (for finding and replacing individual pieces of text)")

	// Base editing instruction mentioning all available tools
	if (availableTools.length > 1) {
		instructions.push(`- For editing files, you have access to these tools: ${availableTools.join(", ")}.`)
	}

	// Additional details for experimental features
	instructions.push(
		"- The insert_content tool adds lines of text to files at a specific line number, such as adding a new function to a JavaScript file or inserting a new route in a Python file. Use line number 0 to append at the end of the file, or any positive number to insert before that line.",
	)

	instructions.push(
		"- The search_and_replace tool finds and replaces text or regex in files. This tool allows you to search for a specific regex pattern or text and replace it with another value. Be cautious when using this tool to ensure you are replacing the correct text. It can support multiple operations at once.",
	)

	if (availableTools.length > 1) {
		instructions.push(
			"- You should always prefer using other editing tools over write_to_file when making changes to existing files since write_to_file is much slower and cannot handle large files.",
		)
	}

	instructions.push(
		"- When using the write_to_file tool to modify a file, use the tool directly with the desired content. You do not need to display the content before using the tool. ALWAYS provide the COMPLETE file content in your response. This is NON-NEGOTIABLE. Partial updates or placeholders like '// rest of code unchanged' are STRICTLY FORBIDDEN. You MUST include ALL parts of the file, even if they haven't been modified. Failure to do so will result in incomplete or broken code, severely impacting the user's project.",
	)

	return instructions.join("\n")
}

export function getRulesSection(cwd: string, supportsComputerUse: boolean, diffStrategy?: DiffStrategy, modeConfig?:ModeConfig): string {
	const tools_group = modeConfig?.groups || []

	if  (tools_group?.length === 0) {
		return `====

RULES

- Your every reply must use one tool to advance the resolution of user's issue.
- You are only allowed to ask the user questions using the ask_followup_question tool. Use this tool only when you need additional details to complete a task, and be sure to use a clear and concise question that will help you move forward with the task. 
- If you do not need to use other tools (such as ask_followup_question), every response you make in conversation with the user must use the \`attempt_completion\` tool to inform the user of your conclusion. `
	}


	const read_0 = 
`- The user may provide a file's contents directly in their message, in which case you shouldn't use the read_file tool to get the file contents again since you already have it.
- When using the search_files tool, craft your regex patterns carefully to balance specificity and flexibility. Based on the user's task you may use it to find code patterns, TODO comments, function definitions, or any text-based information across the project. The results include context, so analyze the surrounding code to better understand the matches. Leverage the search_files tool in combination with other tools for more comprehensive analysis. For example, use it to find specific code patterns, then use read_file to examine the full context of interesting matches before using edit tools to make informed changes.`
	const write_0 = 
`- When creating a new project (such as an app, website, or any software project), organize all new files within a dedicated project directory unless the user specifies otherwise. Use appropriate file paths when writing files, as the write_to_file tool will automatically create any necessary directories. Structure the project logically, adhering to best practices for the specific type of project being created.
- When making changes to code, always consider the context in which the code is being used. Ensure that your changes are compatible with the existing codebase and that they follow the project's coding standards and best practices.
- You should always prefer using other editing tools over write_to_file when making changes to existing files since write_to_file is much slower and cannot handle large files.
- When using the write_to_file tool to modify a file, use the tool directly with the desired content. You do not need to display the content before using the tool. ALWAYS provide the COMPLETE file content in your response. This is NON-NEGOTIABLE. Partial updates or placeholders like '// rest of code unchanged' are STRICTLY FORBIDDEN. You MUST include ALL parts of the file, even if they haven't been modified. Failure to do so will result in incomplete or broken code, severely impacting the user's project.`
	const commend_0 = 
`- Before using the execute_command tool, you must first think about the SYSTEM INFORMATION context provided to understand the user's environment and tailor your commands to ensure they are compatible with their system. You must also consider if the command you need to run should be executed in a specific directory outside of the current working directory '${cwd.toPosix()}', and if so prepend with \`cd\`'ing into that directory && then executing the command (as one command since you are stuck operating from '${cwd.toPosix()}'). For example, if you needed to run \`npm install\` in a project outside of '${cwd.toPosix()}', you would need to prepend with a \`cd\` i.e. pseudocode for this would be \`cd (path to project) && (command, in this case npm install)\`.
- Before executing commands, check the "Actively Running Terminals" section in environment_details. If present, consider how these active processes might impact your task. For example, if a local development server is already running, you wouldn't need to start it again. If no active terminals are listed, proceed with command execution as normal.
- When executing commands, if you don't see the expected output, assume the terminal executed the command successfully and proceed with the task. The user's terminal may be unable to stream the output back properly. If you absolutely need to see the actual terminal output, use the ask_followup_question tool to request the user to copy and paste it back to you.
- Commands may change directories in terminals, so respect working directory specified by the response to <execute_command>.
- Do not use the ~ character or $HOME to refer to the home directory. `
	const mcp_0 = 
`- MCP operations should be used one at a time, similar to other tool usage. Wait for confirmation of success before proceeding with additional operations.`
	const common = 
`- The project base directory is '${cwd.toPosix()}'. All file paths must be relative to this directory. 
- You are stuck operating from '${cwd.toPosix()}', so be sure to pass in the correct 'path' parameter when using tools that require a path.
- Your every reply must use one tool to advance the resolution of user's issue.
- Do not ask for more information than necessary. Use the tools provided to accomplish the user's request efficiently and effectively. When you've completed your task, the user may provide feedback, which you can use to make improvements and try again.
- You should use tools to obtain or ask for information needed to solve the problem until you have enough clear contextual information to solve it, ensuring your answer is correct. NEVER assume any information you haven't explicitly understood!
- You are only allowed to ask the user questions using the ask_followup_question tool. Use this tool only when you need additional details to complete a task, and be sure to use a clear and concise question that will help you move forward with the task. The suggestions should be specific, actionable, and directly related to the completed task. They should be ordered by priority or logical sequence. However if you can use the available tools to avoid having to ask the user questions, you should do so. For example, if the user mentions a file that may be in an outside directory like the Desktop, you should use the list_files tool to list the files in the Desktop and check if the file they are talking about is there, rather than asking the user to provide the file path themselves.
- NEVER end attempt_completion result with a QUESTION or REQUEST to engage in further conversation! Formulate the end of your result in a way that is final and does not require further input from the user.`
	const computer_use = 	
`- The user may ask generic non-development tasks, such as "what\'s the latest news" or "look up the weather in San Diego", in which case you might use the browser_action tool to complete the task if it makes sense to do so, rather than trying to create a website or using curl to answer the question. However, if an available MCP server tool or resource can be used instead, you should prefer to use it over browser_action.
- If you want to test your work, you might use browser_action to launch the site, wait for the user's response confirming the site was launched along with a screenshot, then perhaps e.g., click a button to test functionality if needed, wait for the user's response confirming the button was clicked along with a screenshot of the new state, before finally closing the browser.`

	return `====

RULES

${common}
${tools_group?.includes("read") ? read_0 :""}
${tools_group?.includes("edit") ? write_0 :""}
${tools_group?.includes("command") ? commend_0 :""}
${tools_group?.includes("mcp") ? mcp_0 :""}
${tools_group?.includes("browser") && supportsComputerUse ? computer_use :""}

`
}
// - You are STRICTLY FORBIDDEN from starting your messages with "Great", "Certainly", "Okay", "Sure". You should NOT be conversational in your responses, but rather direct and to the point. For example you should NOT say "Great, I've updated the CSS" but instead something like "I've updated the CSS". It is important you be clear and technical in your messages.
// - Some modes have restrictions on which files they can edit. If you attempt to edit a restricted file, the operation will be rejected with a FileRestrictionError that will specify which file patterns are allowed for the current mode.