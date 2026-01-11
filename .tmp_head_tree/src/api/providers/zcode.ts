import { zCodeDefaultModelId, zCodeModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./rid-providers/providers-new"

export class ZCodeHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.zcodeApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? zCodeDefaultModelId,
			openAiBaseUrl: options.zcodeBaseUrl ?? "https://riddler.mynatapp.cc/llm/zai/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? zCodeDefaultModelId
		const info = zCodeModels[id as keyof typeof zCodeModels] || zCodeModels[zCodeDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}
