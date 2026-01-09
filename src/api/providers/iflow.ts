import { iFlowDefaultModelId, iFlowModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./rid-providers/providers-new"

export class IFlowHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.iflowApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? iFlowDefaultModelId,
			openAiBaseUrl: options.iflowBaseUrl ?? "https://riddler.mynatapp.cc/llm/iflow/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? iFlowDefaultModelId
		const info = iFlowModels[id as keyof typeof iFlowModels] || iFlowModels[iFlowDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}
