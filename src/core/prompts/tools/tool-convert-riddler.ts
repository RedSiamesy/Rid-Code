/**
 * Common utility functions for converting OpenAI tool calls to XML format
 */

/**
 * Escape XML special characters in a string
 */
export function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/**
 * Parse OpenAI tool call arguments (handles both string and object formats)
 */
export function parseToolArgs(toolCall: any): any {
	const args = toolCall.function.arguments
	if (typeof args === 'string') {
		return JSON.parse(args)
	}
	return args
}

/**
 * Generate XML for simple key-value parameters
 */
export function generateSimpleParamsXml(params: Record<string, any>, exclude: string[] = []): string {
	return Object.entries(params)
		.filter(([key]) => !exclude.includes(key))
		.map(([key, value]) => {
			if (value === null || value === undefined) {
				return ''
			}
			const escapedValue = typeof value === 'string' ? escapeXml(value) : value
			return `<${key}>${escapedValue}</${key}>`
		})
		.filter(Boolean)
		.join('\n')
}

/**
 * Generate XML for array parameters
 */
export function generateArrayParamsXml(params: Record<string, any>, arrayKeys: string[]): string {
	return arrayKeys
		.filter(key => params[key] && Array.isArray(params[key]))
		.map(key => {
			const items = params[key].map((item: any) => {
				const escapedItem = typeof item === 'string' ? escapeXml(item) : item
				return `${escapedItem}`
			}).join('\n')
			return `<${key}>
${items}
</${key}>`
		})
		.join('\n')
}























// Individual tool conversion functions
export function convertReadFileArgsToXml(files: any): string {
	// Multiple files format
	const filesContent = files.map((file: any) => {
		const fileParams = generateSimpleParamsXml(file, ['path'])
			return `<file>
<path>${escapeXml(file.path)}</path>
${fileParams ? fileParams.replace(/\n/g, '\n') : ''}
</file>`
}).join('\n') || ''
	return filesContent
}









export function convertUpdateTodoListToXml(todos: any): string {
	if (!todos || !todos.length) { return "" }

	const todosContent = todos.map((todo: string) => escapeXml(todo)).join('\n')
	return todosContent
}

export function convertAskFollowUpQuestionToXml(suggests: any): string {
	if (!suggests || !suggests.length) { return "" }

	const suggestsContent = suggests.map((suggest: string) => `<suggest>${escapeXml(suggest)}</suggest>`).join('\n')
	return suggestsContent
}










export function convertApplyDiffToXml(diffs: any): string {
	const diffBlocks = diffs.map((diff: any) => {
		return `<<<<<<< SEARCH
:start_line: ${diff.start_line}
-------
${diff.src}
=======
${diff.dst}
>>>>>>> REPLACE`
	}).join('\n\n')
	return diffBlocks
}