import { modelScopeDefaultModelId, modelScopeModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./rid-providers/providers-new"

export class ModelScopeHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.modelScopeApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? modelScopeDefaultModelId,
			openAiBaseUrl: options.modelScopeBaseUrl ?? "https://riddler.mynatapp.cc/llm/modelscope/v1",
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
