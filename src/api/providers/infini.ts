import { infiniDefaultModelId, infiniModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./rid-providers/providers-new"

export class InfiniHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.infiniApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? infiniDefaultModelId,
			openAiBaseUrl: options.infiniBaseUrl ?? "https://riddler.mynatapp.cc/llm/infini/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? infiniDefaultModelId
		const info = infiniModels[id as keyof typeof infiniModels] || infiniModels[infiniDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}
