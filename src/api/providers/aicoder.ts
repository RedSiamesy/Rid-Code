import { aiCoderDefaultModelId, aiCoderModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./rid-providers/providers-new"

export class AiCoderHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.aiCoderApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? aiCoderDefaultModelId,
			openAiBaseUrl: options.aiCoderBaseUrl ?? "https://riddler.mynatapp.cc/llm/aicoder/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? aiCoderDefaultModelId
		const info = aiCoderModels[id as keyof typeof aiCoderModels] || aiCoderModels[aiCoderDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}
