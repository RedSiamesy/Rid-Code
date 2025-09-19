import { ToolArgs, OpenAIToolDefinition } from "./types"

export function getApplyDiffOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "apply_diff",
			description: "Request to apply PRECISE, TARGETED modifications to an existing file by searching for specific sections of content and replacing them. This tool is for SURGICAL EDITS ONLY - specific changes to existing code. You can perform multiple distinct search and replace operations within a single 'apply_diff' call by providing multiple diff blocks. This is the preferred way to make several targeted changes efficiently. ALWAYS make as many changes in a single 'apply_diff' request as possible using multiple SEARCH/REPLACE blocks.",
			parameters: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: `The path of the file to modify (relative to the current workspace directory ${args.cwd})`
					},
					diff: {
						type: "array",
						description: "An array of search/replace blocks to apply. Each block contains start_line, src, and dst for a specific edit operation. Each diff block should precisely point to the part you need to modify, and avoid referencing large amounts of parts that do not need modification.",
						items: {
							type: "object",
							properties: {
								start_line: {
									type: "string",
									description: "String of an integer representing the line number of original content where the search block starts (1-based)"
								},
								src: {
									type: "string",
									description: "The exact content to find including whitespace and indentation. Must exactly match existing content."
								},
								dst: {
									type: "string",
									description: "The new content to replace with. Make sure to handle any closing brackets or syntax that may be affected by the diff."
								}
							},
							required: ["start_line", "src", "dst"]
						}
					}
				},
				required: ["path", "diff"]
			}
		}
	}
}