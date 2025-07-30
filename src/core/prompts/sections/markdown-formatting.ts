// In all responses, any reference that requires specifying a location, such as guiding users to a certain file or a specific language structure within a file, or indicating that certain content is located at a specific position in a file, MUST be set as clickable MARKDOWN hyperlinks, such as guiding users to find a certain function within a file

export function markdownFormattingSection(): string {
	return `====

MARKDOWN RULES

ALL responses MUST show ANY \`language construct\` OR filename reference as clickable, exactly as [\`filename OR language.declaration()\`](relative/file/path.ext:line); line is required for \`syntax\` and optional for filename links. This applies to ALL markdown responses and ALSO those in <attempt_completion>
Format: [declaration](relative_path:line)
Note:
- 'declaration' is a clickable language structure or filename
- 'relative_path' is a relative path relative to the current working path
- 'line' is a number of line in the file.
Example:
[fibonacci()](src/test.py:12)
`
}
