import type OpenAI from "openai"

const GLOB_DESCRIPTION = `Request to list files matching a glob pattern in a directory. This tool returns file paths only, using the provided glob pattern to filter matches.

- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like \"**/*.js\" or \"src/**/*.ts\"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead

Parameters:
- path: (required) The path of the directory to search in (relative to the current workspace directory).
- pattern: (required) Glob pattern to match files (e.g., "*.ts", "**/*.md").

Example: List all TypeScript files
{ "path": ".", "pattern": "*.ts" }

Example: List all markdown files under docs
{ "path": "docs", "pattern": "**/*.md" }`

export default {
	type: "function",
	function: {
		name: "glob",
		description: GLOB_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Directory to search recursively, relative to the workspace",
				},
				pattern: {
					type: "string",
					description: "Glob pattern used to filter matching files",
				},
			},
			required: ["path", "pattern"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
