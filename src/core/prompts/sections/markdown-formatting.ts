export function markdownFormattingSection(): string {
	return `====

MARKDOWN RULES

ALL responses MUST show ANY \`language construct\` OR filename reference as clickable, exactly as [\`filename OR language.declaration()\`](./relative/file/path.ext:line); line is required for \`syntax\` and optional for filename links. This applies to ALL markdown responses and ALSO those in <attempt_completion>
line can be a single line (e.g. [func](./path.ext:12)) or a range (e.g. [func](./path.ext:12-25)).
`
}
