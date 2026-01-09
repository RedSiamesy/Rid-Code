import type OpenAI from "openai"

const GREP_DESCRIPTION = `Request to search files with a regex, with optional context control and file listing mode. This tool can return full context around matches or only list files with matches depending on output_mode.

Usage:

- ALWAYS use Grep for search tasks. NEVER invoke \`grep\` or \`rg\` as a Bash command. The Grep tool has been optimized for correct permissions and access.
- Supports full regex syntax (e.g., "log.*Error", "function\s+\w+")
- Filter files with glob parameter (e.g., "*.js", "**/*.tsx")
- Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default)
- Use 'new_task' tool with 'ask' mode for open-ended searches requiring multiple rounds
- Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use \`interface\\{\\}\` to find \`interface{}\` in Go code)

Parameters:
- path: (required) The path of the directory to search in (relative to the current workspace directory).
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts'). Use null to search all files.
- output_mode: (optional) "content" to include matching lines with context, or "files_with_matches" for file lists only. Use null for the default.
- after_context: (optional) Number of lines after each match. Ignored if context is provided.
- before_context: (optional) Number of lines before each match. Ignored if context is provided.
- context: (optional) Number of lines before and after each match. Overrides after_context/before_context when set.
- insensitive_case: (optional) Set true for case-insensitive matching.

Example: List files with TODOs
{ "path": ".", "regex": "TODO", "file_pattern": "*.ts", "output_mode": "files_with_matches", "after_context": null, "before_context": null, "context": null, "insensitive_case": null }

Example: Show matches with 2 lines of context
{ "path": "src", "regex": "function\\s+\\w+", "file_pattern": "*.js", "output_mode": "content", "after_context": 2, "before_context": 2, "context": null, "insensitive_case": false }`

export default {
	type: "function",
	function: {
		name: "grep",
		description: GREP_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Directory to search recursively, relative to the workspace",
				},
				regex: {
					type: "string",
					description: "Rust-compatible regular expression pattern to match",
				},
				file_pattern: {
					type: ["string", "null"],
					description: "Optional glob to limit which files are searched (e.g., *.ts)",
				},
				output_mode: {
					type: ["string", "null"],
					description: "Set to 'content' or 'files_with_matches' (null for default)",
				},
				after_context: {
					type: ["integer", "null"],
					description: "Lines of context after each match (ignored if context is set)",
				},
				before_context: {
					type: ["integer", "null"],
					description: "Lines of context before each match (ignored if context is set)",
				},
				context: {
					type: ["integer", "null"],
					description: "Lines of context before and after each match (overrides before/after)",
				},
				insensitive_case: {
					type: ["boolean", "null"],
					description: "Enable case-insensitive matching",
				},
			},
			required: [
				"path",
				"regex",
				"file_pattern",
				"output_mode",
				"after_context",
				"before_context",
				"context",
				"insensitive_case",
			],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
