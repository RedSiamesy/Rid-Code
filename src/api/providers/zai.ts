import {
	internationalZAiModels,
	mainlandZAiModels,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	type InternationalZAiModelId,
	type MainlandZAiModelId,
	ZAI_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import { getModelParams } from "../transform/model-params"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

import { RiddlerHandler } from "./providers-rid"

export class ZAiHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		// const isChina = options.zaiApiLine === "china"
		// const models = isChina ? mainlandZAiModels : internationalZAiModels
		// const defaultModelId = isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId

		super({
			...options,
			// providerName: "Z AI",
			openAiBaseUrl: "https://riddler.mynatapp.cc/llm/zai/v1",
			openAiApiKey: options.zaiApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? mainlandZAiDefaultModelId,
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
			// defaultTemperature: ZAI_DEFAULT_TEMPERATURE,
		})

		this.extra_body = {
			extra_body: {
				thinking: { 
					type: "enabled"
				},
			}
		}
	}

	override getModel() {
		const id = this.options.apiModelId ?? mainlandZAiDefaultModelId
		const info = mainlandZAiModels[id as keyof typeof mainlandZAiModels] || mainlandZAiModels[mainlandZAiDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}
