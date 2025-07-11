export function getCodebaseSearchDescription(): string {
	return `## codebase_search
### codebase_search
Description: Find files most relevant to the search query.
These queries will be used in the RAG code vector database within the CodeBase feature of the AI programming tool to search for contextual code or documentation information that the questions or requirements depend on to resolve them.
This is a semantic search tool, so the query should ask for something semantically matching what is needed.
If it makes sense to only search in a particular directory, please specify it in the path parameter.
When providing queries, pay attention to the following points:
- If code blocks appear in the conversation, note that query may be important fields within the code blocks, such as class names, member names, function names, etc. Identify those identifiers that need to understand their details when solving problems.
- Regarding predicting query not directly present in the conversation:
    a. If the question is code-related, you can try to infer or guess required function names, class names, or other relevant code elements as query.
    b. If it's about documentation, try to infer or guess query that might be contained in the documentation.

Parameters:
- query: (required) The search queries to find relevant code. Allow up to 3 queries, separated by " | ". Each query MUST be in English. Each query should not exceed 30 characters. 
- path: (optional) The path to the file or directory to search in relative to the current working directory. Defaults to the current working directory.
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

### codebase_summary
Description: Retrieves a summary of source code for this project from the codebase.

Parameters:
- path: (optional) The path to the file or directory to get codebase summary. Defaults to the current working directory.
Usage:
<codebase_search>
<path>Path to the directory or file to search in (optional)</path>
</codebase_search>

Example: Get codebase summary to the all surpported file in current working directory.
<codebase_search>
</codebase_search>

Example: Get codebase summary to the all surpported file in '/path/to/directory_or_file'.
<codebase_search>
<path>/path/to/directory_or_file</path>
</codebase_search>
`
}
