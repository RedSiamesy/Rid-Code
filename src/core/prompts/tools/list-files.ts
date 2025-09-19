import { ToolArgs, OpenAIToolDefinition } from "./types"

export function getListFilesDescription(args: ToolArgs): string {
	return `## list_files
Description: Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.
Parameters:
- path: (required) The path of the directory to list contents for (relative to the current workspace directory ${args.cwd})
- recursive: (optional) Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.
- mode: (optional) Filter mode for results. Use "file_only" to list only files, "dir_only" to list only directories, or omit to list both files and directories.
Usage:
<list_files>
<path>Directory path here</path>
<recursive>true or false (optional)</recursive>
<mode>file_only or dir_only or omit to list all (optional)</mode>
</list_files>

IMPORTANT: You should use the \`list_files\` tool as LITTLE as possible, and instead use the \`Glob\` tool, which is a powerful search tool that also has the function of matching specific filenames in a directory according to certain patterns.`
}
// IMPORTANT: Use \`list_files\` as LITTLE as possible, and instead use the \`Glob\` usage of \`search_files\` for more precise matching searches.

export function getListFilesOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "list_files",
			description: "Lists files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. You should use the \`list_files\` tool as LITTLE as possible, and instead use the \`Glob\` tool, which is a powerful search tool that also has the function of matching specific filenames in a directory according to certain patterns.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: `The path of the directory to list contents for (relative to the current workspace directory ${args.cwd})`
					},
					recursive: {
						type: "string",
						enum: ["true", "false"],
						description: "Whether to list files recursively. Use true for recursive listing, false or omit for top-level only."
					},
					mode: {
						type: "string",
						enum: ["file_only", "dir_only"],
						description: "Filter mode for results. Use 'file_only' to list only files, 'dir_only' to list only directories, or omit to list both files and directories."
					}
				},
				required: ["path"]
			}
		}
	}
}