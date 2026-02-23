import { aliyunDefaultModelId, aliyunModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./rid-providers/providers-new"

export class AliyunHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.aliyunApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? aliyunDefaultModelId,
			openAiBaseUrl: options.aliyunBaseUrl ?? "https://riddler.mynatapp.cc/llm/aliyun/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? aliyunDefaultModelId
		const info = aliyunModels[id as keyof typeof aliyunModels] || aliyunModels[aliyunDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}
