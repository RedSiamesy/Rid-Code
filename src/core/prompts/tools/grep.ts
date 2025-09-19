import { ToolArgs, OpenAIToolDefinition } from "./types"

export function getGrepDescription(args: ToolArgs): string {
	return `## grep
Description: Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.

- ALWAYS use Grep for search tasks. NEVER invoke \`grep\` or \`rg\` as a Bash command. The Grep tool has been optimized for correct permissions and access.
- Supports full regex syntax (e.g., "log.*Error", "function\s+\w+")
- Filter files with glob parameter (e.g., "*.js", "**/*.tsx")
- Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default)
- Use Task tool for open-ended searches requiring multiple rounds
- Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use \`interface\\{\\}\` to find \`interface{}\` in Go code)

Parameters:
- path: (required) The path of the directory to search in (relative to the current workspace directory ${args.cwd}). This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files, MUST conform to the syntax of the \`--glob\` parameter of the rg command (e.g., '*.ts' for TypeScript files, '*.{ts,js,json}' for TypeScript, JavaScript and JSON files). If not provided, it will search all files (*).
- output_mode: (optional) Output mode for the search results. Can be "content" (default, shows file content with matches) or "files_with_matches" (only shows the list of files that contain matches without content).

Usage:
<grep>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
<output_mode>content or files_with_matches (optional)</output_mode>
</grep>

Example: Requesting to search for 'abc' in .ts files and .js files in the current directory
<grep>
<path>.</path>
<regex>abc</regex>
<file_pattern>*.{ts,js}</file_pattern>
<output_mode>files_with_matches</output_mode>
</grep>
`
}


const description = `
A powerful search tool built on ripgrep

Usage:

- ALWAYS use Grep for search tasks. NEVER invoke \`grep\` or \`rg\` as a Bash command. The Grep tool has been optimized for correct permissions and access.
- Supports full regex syntax (e.g., "log.*Error", "function\s+\w+")
- Filter files with glob parameter (e.g., "*.js", "**/*.tsx")
- Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default)
- Use Task tool for open-ended searches requiring multiple rounds
- Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use \`interface\\{\\}\` to find \`interface{}\` in Go code)
`

export function getGrepOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "grep",
			description,
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: `The path of the directory to search in (relative to the current workspace directory ${args.cwd}). This directory will be recursively searched.`
					},
					regex: {
						type: "string",
						description: "The regular expression pattern to search for. Uses Rust regex syntax."
					},
					file_pattern: {
						type: "string",
						description: "Glob pattern to filter files (e.g., '*.ts' for TypeScript files, '*.{ts,js,json}' for multiple extensions). If not provided, searches all files."
					},
					output_mode: {
						type: "string",
						enum: ["content", "files_with_matches"],
						description: "Output mode for the search results. 'content' shows file content with matches, 'files_with_matches' shows only the list of files that contain matches."
					}
				},
				required: ["path", "regex"]
			}
		}
	}
}