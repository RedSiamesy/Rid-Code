import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"

import { type ModelInfo, openAiModelInfoSaneDefaults } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { SELECTOR_SEPARATOR, stringifyVsCodeLmModelSelector } from "../../shared/vsCodeSelectorUtils"

import { ApiStream } from "../transform/stream"
import { convertToVsCodeLmMessages } from "../transform/vscode-lm-format"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

import { RiddlerHandler } from "./providers-rid"

export class VsCodeLmHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.deepSeekApiKey ?? "not-provided",
			openAiModelId: options.apiModelId,
			openAiBaseUrl: options.deepSeekBaseUrl ?? "https://riddler.mynatapp.cc/llm/copilot/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		yield* super.createMessage(systemPrompt, messages, metadata)
		yield {
			type: "usage",
			inputTokens: systemPrompt.length + messages.reduce((sum, msg) => {
				if (typeof msg.content === 'string') {
					return sum + msg.content.length
				} else if (Array.isArray(msg.content)) {
					return sum + msg.content.reduce((contentSum, block) => {
						if (block.type === 'text') {
							return contentSum + (block.text?.length || 0)
						}
						return contentSum
					}, 0)
				}
				return sum
			}, 0),
			outputTokens: 0,
		}
	}
}


// Static blacklist of VS Code Language Model IDs that should be excluded from the model list e.g. because they will never work
const VSCODE_LM_STATIC_BLACKLIST: string[] = ["claude-3.7-sonnet", "claude-3.7-sonnet-thought"]

export async function getVsCodeLmModels() {
	try {
		const models = (await vscode.lm.selectChatModels({})) || []
		return models.filter((model) => !VSCODE_LM_STATIC_BLACKLIST.includes(model.id))
	} catch (error) {
		console.error(
			`Error fetching VS Code LM models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
		return []
	}
}
