import { zenDefaultModelId, zenModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./rid-providers/providers-new"

export class ZenHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.zenApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? zenDefaultModelId,
			openAiBaseUrl: options.zenBaseUrl ?? "https://riddler.mynatapp.cc/llm/zen/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? zenDefaultModelId
		const info = zenModels[id as keyof typeof zenModels] || zenModels[zenDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}
