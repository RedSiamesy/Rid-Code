import { ToolArgs, OpenAIToolDefinition } from "./types"

export function getCodebaseSearchDescription(args: ToolArgs): string {
	return `## codebase_search
### codebase_search (Search)
Description: This tool performs a semantic search on a vector database of code and documentation. It retrieves the most relevant contextual information needed to answer user questions or resolve their requirements. The search is based on semantic meaning, not just keyword matching.

When generating a 'query', follow these guidelines:

- **Extract from Code:** If the conversation includes code snippets, extract key identifiers like class names, function names, method names, or variable names. These are often the most crucial elements to search for to understand the code's purpose and functionality.
- **Infer from Context:** Go beyond the literal words in the conversation.
    - **For Code-related Questions:** Infer potential function names, class names, or design patterns that might exist in the codebase to solve the user's problem.
    - **For Documentation-related Questions:** Infer concepts, features, or "how-to" topics that would likely be covered in the documentation.
- **Be Specific and Clear:**
    - Formulate clear, descriptive queries. Avoid using overly short or ambiguous abbreviations.
    - If the context strongly suggests the information is in a specific location, use the 'path' parameter to narrow the search.

Parameters:
- query: (required) A semantic query (or queries) to find relevant code or documentation. You can provide up to 4 queries, separated by " | ". Each query should be a meaningful phrase (at least 4 Chinese characters or 2 English words). Provide queries in both Chinese and English.
- path: (optional) The relative path to a file or directory to restrict the search. Defaults to the entire codebase.
Usage:
<codebase_search>
<query>Your natural language query here</query>
<path>Path to the directory to search in (optional)</path>
</codebase_search>

Example: Searching for functions related to user authentication
<codebase_search>
<query>User login and password hashing</query>
<path>/path/to/directory</path>
</codebase_search>


### codebase_search (Summary)
Description: Generates a detailed summary of a file or a directory's contents.

This tool provides a high-level overview to help you quickly understand a codebase.
- **If the path points to a file:** It returns a summary of the entire file, plus summaries of key sections (e.g., classes, functions) with their corresponding line numbers.
- **If the path points to a directory:** It returns summaries for all supported files within that directory.

Use this tool when you need to grasp the purpose and structure of a file or directory before diving into the details.

**Important Note:** The tool is named 'codebase_search', but its function in this parameters rule is to **summarize**, not to search for a query.

Parameters:
- path: (optional) The relative path to the file or directory to be summarized. Defaults to the current working directory ('.').
Usage:
<codebase_search>
<path>Path to the directory or file to summarize (optional)</path>
</codebase_search>

Example: Get a summary of a specific file or all supported files in '/path/to/directory_or_file'.
<codebase_search>
<path>/path/to/directory_or_file</path>
</codebase_search>
`
}


const description = `
Performs a semantic search on a vector database of code and documentation, or generates a detailed summary of a file or directory's contents. 
The search is based on semantic meaning, not just keyword matching.

If 'query' is provided, it performs a semantic search on the codebase.
If 'query' is not provided, it generates a summary of the specified path.
`
const query_description = `
If given a 'query', follow these guidelines:

- **Extract from Code:** If the conversation includes code snippets, extract key identifiers like class names, function names, method names, or variable names. These are often the most crucial elements to search for to understand the code's purpose and functionality.
- **Infer from Context:** Go beyond the literal words in the conversation.
    - **For Code-related Questions:** Infer potential function names, class names, or design patterns that might exist in the codebase to solve the user's problem.
    - **For Documentation-related Questions:** Infer concepts, features, or "how-to" topics that would likely be covered in the documentation.
- **Be Specific and Clear:**
    - Formulate clear, descriptive queries. Avoid using overly short or ambiguous abbreviations.
    - If the context strongly suggests the information is in a specific location, use the 'path' parameter to narrow the search.
`

const path_description = `
The relative path to a file or directory to restrict the search or summarize. Defaults to the entire codebase for search, or current working directory for summary.
If 'query' is given, this parameter indicates the range of files or directories to search.
If 'query' is not given, this parameter indicates the range of files or directories to generate summaries for.
`

export function getCodebaseSearchOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition {
	return {
		type: "function",
		function: {
			name: "codebase_search",
			description,
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: query_description
					},
					path: {
						type: "string",
						description: path_description
					}
				},
				required: []
			}
		}
	}
}