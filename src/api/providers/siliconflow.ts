import { siliconFlowModels, siliconFlowDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import type { ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { RiddlerHandler } from "./providers-rid"

export class SiliconFlowHandler extends RiddlerHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			openAiApiKey: options.siliconFlowApiKey ?? "not-provided",
			openAiModelId: options.apiModelId ?? siliconFlowDefaultModelId,
			openAiBaseUrl: options.siliconFlowBaseUrl ?? "https://riddler.mynatapp.cc/llm/siliconflow/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}

	override getModel() {
		const id = this.options.apiModelId ?? siliconFlowDefaultModelId
		const info = siliconFlowModels[id as keyof typeof siliconFlowModels] || siliconFlowModels[siliconFlowDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}
}