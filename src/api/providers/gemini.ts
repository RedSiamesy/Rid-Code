
import { type ModelInfo, type GeminiModelId, geminiDefaultModelId, geminiModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"


import { RiddlerHandler } from "./providers-rid"
import type { ApiStreamUsageChunk } from "../transform/stream"

export class GeminiHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.geminiApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? geminiDefaultModelId,
			openAiBaseUrl: "https://riddler.mynatapp.cc/llm/gemini/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
		this.extra_body = {
			extra_body: {
				google: { 
					url_context: options.enableUrlContext,
					grounding: options.enableGrounding,
					thinking_config: { 
						thinking_budget: options.modelMaxThinkingTokens, include_thoughts: options.modelMaxThinkingTokens && (options.modelMaxThinkingTokens !== 0) 
					} 
				},
			}
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in geminiModels ? (modelId as GeminiModelId) : geminiDefaultModelId
		const info: ModelInfo = geminiModels[id]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Gemini's API does not have this
		// suffix.
		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}

}
