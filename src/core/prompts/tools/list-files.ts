import { ToolArgs } from "./types"

export function getListFilesDescription(args: ToolArgs): string {
	return `## list_files
Description: Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.
Parameters:
- path: (required) The path of the directory to list contents for (relative to the current workspace directory ${args.cwd})
- recursive: (optional) Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.
Usage:
<list_files>
<path>Directory path here</path>
<recursive>true or false (optional)</recursive>
</list_files>

Example: Requesting to list all files in the current directory
<list_files>
<path>.</path>
<recursive>false</recursive>
</list_files>


Tips: You should use the \`list_files\` tool as LITTLE as possible, and instead use the \`search_files\` (Grep/Glob) tool, which is a powerful search tool that also has the function of matching specific filenames in a directory according to certain patterns.`
}
// IMPORTANT: Use \`list_files\` as LITTLE as possible, and instead use the \`Glob\` usage of \`search_files\` for more precise matching searches.
