import { ToolArgs, OpenAIToolDefinition } from "./types"

export function getGlobDescription(args: ToolArgs): string {
	return `## glob
Description: Search for files matching a specific glob pattern in a directory. This tool is optimized for finding files by name patterns and provides a fast way to locate files based on their paths and extensions.

- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like \"**/*.js\" or \"src/**/*.ts\"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead

Parameters:
- path: (required) The path of the directory to search in (relative to the current workspace directory ${args.cwd}). This directory will be recursively searched.
- pattern: (required) Glob pattern to match files (e.g., '*.ts' for TypeScript files, '*.{ts,js,json}' for multiple extensions, 'src/**/*.tsx' for React components in src directory).

Usage:
<glob>
<path>Directory path here</path>
<pattern>Glob pattern here</pattern>
</glob>

Example: Find all React component files in src directory and subdirectories
<glob>
<path>src</path>
<pattern>**/*.{tsx,jsx}</pattern>
</glob>

### Glob Pattern Examples:

- \`*.js\` - All JavaScript files in the specified directory
- \`**/*.ts\` - All TypeScript files in any subdirectory
- \`src/**/*.{ts,tsx}\` - TypeScript and TSX files in src directory tree
- \`test/**/*.spec.js\` - Test files with .spec.js extension
- \`**/README.md\` - All README.md files anywhere in the directory tree
- \`components/*/index.ts\` - index.ts files in immediate subdirectories of components
`
}

const description = `
Search for files matching a specific glob pattern in a directory. This tool is optimized for finding files by name patterns and provides a fast way to locate files based on their paths and extensions.

- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like \"**/*.js\" or \"src/**/*.ts\"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead
`


export function getGlobOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "glob",
			description,
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "The path of the directory to search in (relative to the current workspace directory ${args.cwd}). This directory will be recursively searched."
					},
					pattern: {
						type: "string",
						description: "The glob pattern to match files against (e.g., '*.ts' for TypeScript files, '*.{ts,js,json}' for multiple extensions, 'src/**/*.tsx' for React components in src directory)."
					}
				},
				required: ["path", "pattern"]
			}
		}
	}
}