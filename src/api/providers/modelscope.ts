import { modelScopeModels, modelScopeDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./providers-rid"

export class ModelScopeHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.modelscopeApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? modelScopeDefaultModelId,
			openAiBaseUrl: options.modelscopeBaseUrl ?? "https://riddler.mynatapp.cc/api/modelscope/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? modelScopeDefaultModelId
		const info = modelScopeModels[id as keyof typeof modelScopeModels] || modelScopeModels[modelScopeDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}