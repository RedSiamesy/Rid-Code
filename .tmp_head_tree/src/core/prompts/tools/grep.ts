import { ToolArgs } from "./types"

export function getGrepDescription(args: ToolArgs): string {
	return `## grep
Description: A powerful search tool built on ripgrep. Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.

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
- output_mode: (optional) Output mode for the search results. Defaults to \"files_with_matches\".
	- "content" shows matching lines (supports -A/-B/-C context with \"after_context\"/\"before_context\"/\"context\").
	- "files_with_matches" shows file paths. 
- after_context: (optional) Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.
- before_context: (optional) Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.
- context: (optional) Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.
- insensitive_case: (optional) Case insensitive search (rg -i). Defaults to \"false\" (case-sensitive).

Usage:
<grep>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
<output_mode>content or files_with_matches (optional)</output_mode>
<after_context>number of lines after match (optional)</after_context>
<before_context>number of lines before match (optional)</before_context>
<context>number of lines before and after match (optional)</context>
<insensitive_case>true or false (optional)</insensitive_case>
</grep>

Example: Requesting to search for 'abc' in .ts files and .js files in the current directory
<grep>
<path>.</path>
<regex>abc</regex>
<file_pattern>*.{ts,js}</file_pattern>
<output_mode>files_with_matches</output_mode>
</grep>

Example: Requesting to search for 'TODO:' with 5 lines before and 50 lines after each match
<grep>
<path>.</path>
<regex>TODO:</regex>
<file_pattern>*.{ts,js}</file_pattern>
<output_mode>content</output_mode>
<before_context>5</before_context>
<after_context>50</after_context>
</grep>

Example: Requesting to search for 'ERROR:' with 10 lines before and after each match using context parameter
<grep>
<path>.</path>
<regex>ERROR:</regex>
<file_pattern>*.log</file_pattern>
<output_mode>content</output_mode>
<context>10</context>
</grep>
`
}
