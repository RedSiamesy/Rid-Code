import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	type ModelInfo,
	openAiNativeDefaultModelId,
	OpenAiNativeModelId,
	openAiNativeModels,
	OPENAI_NATIVE_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { calculateApiCostOpenAI } from "../../shared/cost"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

import { chatCompletions_Stream, chatCompletions_NonStream } from "./tools-rid"

export type OpenAiNativeModel = ReturnType<OpenAiNativeHandler["getModel"]>

export class OpenAiNativeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		const baseURL = this.options.openAiNativeBaseUrl ?? "https://riddler.mynatapp.cc/api/openai/v1"
		this.client = new OpenAI({ baseURL, apiKey })
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		let id: "o3-mini" | "o3" | "o4-mini" | undefined

		if (model.id.startsWith("o3-mini")) {
			id = "o3-mini"
		} else if (model.id.startsWith("o3")) {
			id = "o3"
		} else if (model.id.startsWith("o4-mini")) {
			id = "o4-mini"
		}

		if (id) {
			yield* this.handleReasonerMessage(model, id, systemPrompt, messages)
		} else if (model.id.startsWith("o1")) {
			yield* this.handleO1FamilyMessage(model, systemPrompt, messages)
		} else {
			yield* this.handleDefaultModelMessage(model, systemPrompt, messages)
		}
	}

	private async *handleO1FamilyMessage(
		model: OpenAiNativeModel,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ApiStream {
		// o1 supports developer prompt with formatting
		// o1-preview and o1-mini only support user messages
		const isOriginalO1 = model.id === "o1"
		const response = await chatCompletions_Stream(this.client, {
			model: model.id,
			messages: [
				{
					role: isOriginalO1 ? "developer" : "user",
					content: isOriginalO1 ? `Formatting re-enabled\n${systemPrompt}` : systemPrompt,
				},
				...convertToOpenAiMessages(messages),
			],
			stream: true,
			stream_options: { include_usage: true },
		})

		yield* this.handleStreamResponse(response, model)
	}

	private async *handleReasonerMessage(
		model: OpenAiNativeModel,
		family: "o3-mini" | "o3" | "o4-mini",
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ApiStream {
		const { reasoning } = this.getModel()

		const stream = await chatCompletions_Stream(this.client, {
			model: family,
			messages: [
				{
					role: "developer",
					content: `Formatting re-enabled\n${systemPrompt}`,
				},
				...convertToOpenAiMessages(messages),
			],
			stream: true,
			stream_options: { include_usage: true },
			...(reasoning && reasoning),
		})

		yield* this.handleStreamResponse(stream, model)
	}

	private async *handleDefaultModelMessage(
		model: OpenAiNativeModel,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ApiStream {
		const stream = await chatCompletions_Stream(this.client, {
			model: model.id,
			temperature: this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
		})

		yield* this.handleStreamResponse(stream, model)
	}

	private async *handleStreamResponse(
		stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
		model: OpenAiNativeModel,
	): ApiStream {
		let startTime = Date.now()
		let firstTokenTime: number | null = null
		let hasFirstToken = false
		let lastUsage

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				// Record first token time
				if (!hasFirstToken && delta.content.trim()) {
					firstTokenTime = Date.now()
					hasFirstToken = true
				}

				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			const endTime = Date.now()
			const totalLatency = endTime - startTime
			const firstTokenLatency = firstTokenTime ? firstTokenTime - startTime : totalLatency
			
			// Add timing information to usage
			const enhancedUsage = {
				...lastUsage,
				startTime,
				firstTokenTime,
				endTime,
				totalLatency,
				firstTokenLatency
			}

			yield* this.yieldUsage(model.info, enhancedUsage)
		}
	}

	private async *yieldUsage(info: ModelInfo, usage: OpenAI.Completions.CompletionUsage | undefined): ApiStream {
		const inputTokens = usage?.prompt_tokens || 0 // sum of cache hits and misses
		const outputTokens = usage?.completion_tokens || 0
		const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0
		const cacheWriteTokens = 0
		const totalCost = calculateApiCostOpenAI(info, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
		const nonCachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)

		// Calculate TPS and latency from enhanced usage
		const totalLatency = (usage as any)?.totalLatency || 10
		const firstTokenLatency = (usage as any)?.firstTokenLatency || 10
		
		// Calculate TPS excluding first token latency
		let tps = 0 // default fallback
		if (outputTokens > 1 && totalLatency > firstTokenLatency) {
			const tokensAfterFirst = outputTokens - 1
			const timeAfterFirstToken = totalLatency - firstTokenLatency
			tps = (tokensAfterFirst * 1000) / timeAfterFirstToken
		} else if (outputTokens > 0 && totalLatency > 0) {
			// Fallback: calculate TPS for all tokens including first
			tps = (outputTokens * 1000) / totalLatency
		}

		yield {
			type: "usage",
			inputTokens: nonCachedInputTokens,
			outputTokens: outputTokens,
			cacheWriteTokens: cacheWriteTokens,
			cacheReadTokens: cacheReadTokens,
			totalCost: totalCost,
			tps: tps, // Round to 2 decimal places
			latency: firstTokenLatency, // Use first token latency as the latency metric
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId

		let id =
			modelId && modelId in openAiNativeModels ? (modelId as OpenAiNativeModelId) : openAiNativeDefaultModelId

		const info: ModelInfo = openAiNativeModels[id]

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: OPENAI_NATIVE_DEFAULT_TEMPERATURE,
		})

		// The o3 models are named like "o3-mini-[reasoning-effort]", which are
		// not valid model ids, so we need to strip the suffix.
		return { id: id.startsWith("o3-mini") ? "o3-mini" : id, info, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const { id, temperature, reasoning } = this.getModel()

			const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: id,
				messages: [{ role: "user", content: prompt }],
				temperature,
				...(reasoning && reasoning),
			}

			const content = await chatCompletions_NonStream(this.client, params)
			return content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI Native completion error: ${error.message}`)
			}
			throw error
		}
	}
}
