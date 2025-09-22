import { ToolArgs, OpenAIToolDefinition } from "./types"

/**
 * Generate a simplified read_file tool description for models that only support single file reads
 * Uses the simpler format: <read_file><path>file/path.ext</path></read_file>
 */
export function getSimpleReadFileDescription(args: ToolArgs): string {
	return `## read_file
Description: Request to read the contents of a file. The tool outputs line-numbered content (e.g. "1 | const x = 1") for easy reference when discussing code.

Parameters:
- path: (required) File path (relative to workspace directory ${args.cwd})

Usage:
<read_file>
<path>path/to/file</path>
</read_file>
`
}

export function getSimpleReadFileOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "read_file",
			description: "Request to read the contents of a file. The tool outputs line-numbered content (e.g. '1 | const x = 1') for easy reference when discussing code.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: `File path (relative to workspace directory ${args.cwd})`
					}
				},
				required: ["path"]
			}
		}
	}
}