import * as vscode from "vscode"
import { serializeError } from "serialize-error"
import { GeminiHandler } from "../../api/providers/gemini"

// Create GeminiHandler with fixed configuration for URL content fetching
export const geminiHandler = new GeminiHandler({
	geminiApiKey: "AIzaSyB2dBxjifXLHJ5-juyVHezMxBYzxHtRbvs", // TODO: 需要配置实际的API key
	apiModelId: "gemini-2.5-flash-lite",
	enableGrounding: false,
	enableUrlContext: true, // 启用URL上下文功能来获取网页内容
	modelTemperature: 1.0,
	modelMaxTokens: 32768,
	modelMaxThinkingTokens: 0, // 不需要思考模式
})

export class UrlContentFetcher {

	constructor(context: vscode.ExtensionContext) {
	}

	async launchBrowser(): Promise<void> {
		// For API-based implementation, no browser launch needed
	}

	async closeBrowser(): Promise<void> {
		// For API-based implementation, no browser close needed
	}

	// must make sure to call launchBrowser before and closeBrowser after using this
	async urlToMarkdown(url: string): Promise<string> {
		try {
			// Construct URL fetch prompt
			const fetchPrompt = `你是一个专业的网页内容提取助手，负责从指定URL获取内容。

目标url: ${url}

提取要求：
- 完整提取网页的所有重要内容，包括文本、链接、结构化信息等

请执行以下任务：
1. 访问指定的网页URL
2. 提取网页的核心内容信息
3. 保持内容的原始结构和格式
4. 提取链接地址（以markdown链接形式展示）
5. 识别和提取关键信息点

输出要求：
- 使用markdown格式组织内容
- 保留网页中的链接（格式：[链接文本](URL)）
- 提供网页的基本信息（标题、来源等）
- 如果有表格或列表，请保持结构化格式
- 如果网页内容很长，请提供目录结构
- 除markdown形式的网页内容外，不要添加任何额外说明或评论

重要原则：
- 不要丢失网页信息，不要进行任何删减
- 尽可能完整地忠实地还原网页展示的原始内容
- 保持信息的准确性和完整性
- 如果网页无法访问，请说明具体原因
- 使用清晰的markdown格式便于阅读`

			// Use createMessage for streaming response
			const messages = [
				{
					role: "user" as const,
					content: url,
				},
			]

			let fullResponse = ""
			
			// Process streaming response
			const stream = geminiHandler.createMessage(fetchPrompt, messages)
			
			for await (const chunk of stream) {
				if (chunk.type === "text") {
					fullResponse += chunk.text
				}
				// Skip reasoning chunks for this use case
			}

			if (!fullResponse.trim()) {
				throw new Error('No content received from AI response')
			}

			return fullResponse.trim()
		} catch (error) {
			const serializedError = serializeError(error)
			const errorMessage = serializedError.message || String(error)
			
			// Log error for debugging
			console.error(`Failed to fetch URL content for ${url}:`, errorMessage)
			
			// Re-throw the error for the caller to handle
			throw new Error(`Failed to fetch URL content: ${errorMessage}`)
		}
	}
}
