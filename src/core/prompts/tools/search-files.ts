import { ToolArgs } from "./types"

export function getSearchFilesDescription(args: ToolArgs): string {
	return `## search_files (Grep/Glob tool)
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
<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
<output_mode>content or files_with_matches (optional)</output_mode>
</search_files>

Example: Requesting to search for 'abc' in .ts files and .js files in the current directory
<search_files>
<path>.</path>
<regex>abc</regex>
<file_pattern>*.{ts,js}</file_pattern>
<output_mode>files_with_matches</output_mode>
</search_files>


### Glob Tips:

- You can use the "files_with_matches" mode, fill in ".*" for the regex content to quickly match the file names you need.
- Use this method when you need to find files by name patterns as a fast file pattern matching tool.
- Supports glob patterns like "**/*.js" or "src/**/*.ts"

Example: Requesting to search for all .ts files in the current directory
<search_files>
<path>.</path>
<regex>.*</regex>
<file_pattern>*.ts</file_pattern>
<output_mode>files_with_matches</output_mode>
</search_files>
`
}
