import { qianfanDefaultModelId, qianfanModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./rid-providers/providers-new"

export class QianfanHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.qianfanApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? qianfanDefaultModelId,
			openAiBaseUrl: options.qianfanBaseUrl ?? "https://riddler.mynatapp.cc/llm/qianfan/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? qianfanDefaultModelId
		const info = qianfanModels[id as keyof typeof qianfanModels] || qianfanModels[qianfanDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}
