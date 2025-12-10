import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import axios from "axios"
import { MAX, v4 as uuidv4 } from 'uuid'

import {
	type ModelInfo,
	azureOpenAiDefaultApiVersion,
	openAiModelInfoSaneDefaults,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	OPENAI_AZURE_AI_INFERENCE_PATH,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { XmlMatcher } from "../../utils/xml-matcher"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { convertToSimpleMessages } from "../transform/simple-format"
import { ApiStream, ApiStreamUsageChunk, ApiStreamToolChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { handleOpenAIError } from "./utils/openai-error-handler"

// TODO: Rename this to OpenAICompatibleHandler. Also, I think the
// `OpenAINativeHandler` can subclass from this, since it's obviously
// compatible with the OpenAI API. We can also rename it to `OpenAIHandler`.
export class OpenAiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private readonly providerName = "OpenAI"

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.openAiBaseUrl ?? "https://api.openai.com/v1"
		const apiKey = this.options.openAiApiKey ?? "not-provided"
		const isAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)
		const urlHost = this._getUrlHost(this.options.openAiBaseUrl)
		const isAzureOpenAi = urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure

		const headers = {
			...DEFAULT_HEADERS,
			...(this.options.openAiHeaders || {}),
		}

		const timeout = getApiRequestTimeout()

		if (isAzureAiInference) {
			// Azure AI Inference Service (e.g., for DeepSeek) uses a different path structure
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders: headers,
				defaultQuery: { "api-version": this.options.azureApiVersion || "2024-05-01-preview" },
				timeout,
			})
		} else if (isAzureOpenAi) {
			// Azure API shape slightly differs from the core API shape:
			// https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
			this.client = new AzureOpenAI({
				baseURL,
				apiKey,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
				defaultHeaders: headers,
				timeout,
			})
		} else {
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders: headers,
				timeout,
			})
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		_metadata?: ApiHandlerCreateMessageMetadata,
		tools?: OpenAI.ChatCompletionTool[]
	): ApiStream {
		const { info: modelInfo, reasoning } = this.getModel()
		const modelUrl = this.options.openAiBaseUrl ?? ""
		const modelId = this.options.openAiModelId ?? ""
		const enabledR1Format = this.options.openAiR1FormatEnabled ?? false
		const enabledLegacyFormat = this.options.openAiLegacyFormat ?? false
		const isAzureAiInference = this._isAzureAiInference(modelUrl)
		const deepseekReasoner = modelId.includes("deepseek-reasoner") || enabledR1Format
		const ark = modelUrl.includes(".volces.com")

		if (modelId.includes("o1") || modelId.includes("o3") || modelId.includes("o4")) {
			yield* this.handleO3FamilyMessage(modelId, systemPrompt, messages, tools)
			return
		}

		if (this.options.openAiStreamingEnabled ?? true) {
			let systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
				role: "system",
				content: systemPrompt,
			}

			let convertedMessages

			if (deepseekReasoner) {
				convertedMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
			} else if (ark || enabledLegacyFormat) {
				convertedMessages = [systemMessage, ...convertToSimpleMessages(messages)]
			} else {
				if (modelInfo.supportsPromptCache) {
					systemMessage = {
						role: "system",
						content: [
							{
								type: "text",
								text: systemPrompt,
								// @ts-ignore-next-line
								cache_control: { type: "ephemeral" },
							},
						],
					}
				}

				convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

				if (modelInfo.supportsPromptCache) {
					// Note: the following logic is copied from openrouter:
					// Add cache_control to the last two user messages
					// (note: this works because we only ever add one user message at a time, but if we added multiple we'd need to mark the user message before the last assistant message)
					const lastTwoUserMessages = convertedMessages.filter((msg) => msg.role === "user").slice(-2)

					lastTwoUserMessages.forEach((msg) => {
						if (typeof msg.content === "string") {
							msg.content = [{ type: "text", text: msg.content }]
						}

						if (Array.isArray(msg.content)) {
							// NOTE: this is fine since env details will always be added at the end. but if it weren't there, and the user added a image_url type message, it would pop a text part before it and then move it after to the end.
							let lastTextPart = msg.content.filter((part) => part.type === "text").pop()

							if (!lastTextPart) {
								lastTextPart = { type: "text", text: "..." }
								msg.content.push(lastTextPart)
							}

							// @ts-ignore-next-line
							lastTextPart["cache_control"] = { type: "ephemeral" }
						}
					})
				}
			}

			const isGrokXAI = this._isGrokXAI(this.options.openAiBaseUrl)

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: modelId,
				temperature: this.options.modelTemperature ?? (deepseekReasoner ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
				messages: convertedMessages,
				stream: true as const,
				...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
				...(reasoning && reasoning),
				...(tools && tools.length > 0 ? { tools } : {}),
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let startTime = Date.now()
			let firstTokenTime: number | null = null
			let hasFirstToken = false

			let stream
			try {
				stream = await this.client.chat.completions.create(
					requestOptions,
					isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			const matcher = new XmlMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

			let lastUsage
			let lastToolCache: ApiStreamToolChunk = {
				type: "tool",
				index: undefined,
				tool_call_id: "",
				name: "",
				params: ""
			}

			yield {
				type: "text",
				text: " \n\n",
			}
			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta ?? {}

				if (delta.content) {
					// Record first token time
					if (!hasFirstToken && delta.content.trim()) {
						firstTokenTime = Date.now()
						hasFirstToken = true
					}

					for (const content_chunk of matcher.update(delta.content)) {
						yield content_chunk
					}
				}

				if ("reasoning_content" in delta && delta.reasoning_content) {
					// Record first token time for reasoning content too
					if (!hasFirstToken && (delta.reasoning_content as string)?.trim()) {
						firstTokenTime = Date.now()
						hasFirstToken = true
					}

					if (hasFirstToken) {
						yield {
							type: "reasoning",
							text: (delta.reasoning_content as string | undefined) || "",
						}
					}
				}

				// Handle tool calls
				if (delta.tool_calls && delta.tool_calls.length > 0) {
					if (!hasFirstToken) {
						// if (delta.tool_calls[0].function?.name && !delta.tool_calls[0].function?.arguments) {
						// 	firstTokenTime = Date.now()
						// } else {
						// 	// 有些模型在没有正文时会一次性攒出完整的tool_calls再传出（相当于非流式），首字延迟不准
							firstTokenTime = Math.floor((startTime*90+Date.now()*10)/100)
						// }
						hasFirstToken = true
					}
					for (const toolCall of delta.tool_calls) {
						// && toolCall.function.name && toolCall.function.arguments
						if ('function' in toolCall && toolCall.function ) {
							try {
								// const tool: ApiStreamToolChunk = {
								// 	type: "tool",
								// 	tool_call_id: toolCall.id,
								// 	name: toolCall.function.name,
								// 	params: JSON.parse(toolCall.function.arguments)
								// }
								if (lastToolCache.index !== undefined && toolCall.index !== lastToolCache.index) {
									lastToolCache.params = JSON.parse(lastToolCache.params)
									yield lastToolCache
									lastToolCache = {
										type: "tool",
										index: undefined,
										tool_call_id: "",
										name: "",
										params: ""
									}
								} 
								if (lastToolCache.index === undefined) {
									lastToolCache = {
										type: "tool",
										index: toolCall.index,
										tool_call_id: toolCall.id,
										name: toolCall.function.name || "",
										params: toolCall.function.arguments || ""
									}
									if (chunk.choices[0]?.finish_reason === "tool_calls") {
										lastToolCache.params = JSON.parse(lastToolCache.params)
										yield lastToolCache
										lastToolCache = {
											type: "tool",
											index: undefined,
											tool_call_id: "",
											name: "",
											params: ""
										}
									}
								} else {
									lastToolCache = {
										type: "tool",
										index: lastToolCache.index,
										tool_call_id: lastToolCache.tool_call_id,
										name: lastToolCache.name + (toolCall.function.name || ""),
										params: lastToolCache.params + (toolCall.function.arguments || "")
									}
								}
							} catch (error) {
								throw new Error(`Tool call JSON parsing failed: ${error} (${lastToolCache.params})`)
							}
						}
					}
				}

				if (chunk.usage) {
					lastUsage = chunk.usage
				}
			}
			if (lastToolCache.index !== undefined) {
				try {
					lastToolCache.params = JSON.parse(lastToolCache.params)
					yield lastToolCache
				} catch (error) {
					throw new Error(`Tool call JSON parsing failed: ${error} (${lastToolCache.params})`)
				}
			}

			for (const chunk of matcher.final()) {
				yield chunk
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
				
				yield this.processUsageMetrics(enhancedUsage, modelInfo)
			}
		} else {
			// o1 for instance doesnt support streaming, non-1 temp, or system prompt
			const systemMessage: OpenAI.Chat.ChatCompletionUserMessageParam = {
				role: "user",
				content: systemPrompt,
			}

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: deepseekReasoner
					? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
					: enabledLegacyFormat
						? [systemMessage, ...convertToSimpleMessages(messages)]
						: [systemMessage, ...convertToOpenAiMessages(messages)],
				...(tools && tools.length > 0 ? { tools } : {}),
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let response
			try {
				response = await this.client.chat.completions.create(
					requestOptions,
					this._isAzureAiInference(modelUrl) ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			const message = response.choices[0]?.message
			let content = message?.content || ""

			// Handle tool calls in non-streaming response
			if (message?.tool_calls && message.tool_calls.length > 0) {
				for (const toolCall of message.tool_calls) {
					if ('function' in toolCall && toolCall.function && toolCall.function.name && toolCall.function.arguments) {
						try {
							const tool: ApiStreamToolChunk = {
								type: "tool",
								tool_call_id: toolCall.id,
								name: toolCall.function.name,
								params: JSON.parse(toolCall.function.arguments)
							}
							yield tool
						} catch (error) {
							throw new Error(`Tool call JSON parsing failed: ${error}`)
						}
					}
				}
			}

			yield {
				type: "text",
				text: content,
			}

			yield this.processUsageMetrics(response.usage, modelInfo)
		}
	}

	protected processUsageMetrics(usage: any, _modelInfo?: ModelInfo): ApiStreamUsageChunk {
		const outputTokens = usage?.completion_tokens || 0
		const totalLatency = usage?.totalLatency || 10
		const firstTokenLatency = usage?.firstTokenLatency || 10
		
		// Calculate TPS excluding first token latency
		// TPS = (total_tokens - 1) / (total_time - first_token_time) * 1000
		let tps = 0 // default fallback
		if (outputTokens > 1 && totalLatency > firstTokenLatency) {
			const tokensAfterFirst = outputTokens - 1
			const timeAfterFirstToken = totalLatency - firstTokenLatency
			tps = (tokensAfterFirst * 1000) / timeAfterFirstToken
		} else if (outputTokens > 0 && totalLatency > 0) {
			// Fallback: calculate TPS for all tokens including first
			tps = (outputTokens * 1000) / totalLatency
		}

		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: outputTokens,
			cacheWriteTokens: usage?.cache_creation_input_tokens || undefined,
			cacheReadTokens: usage?.cache_read_input_tokens || undefined,
			tps: tps, // Round to 2 decimal places
			latency: firstTokenLatency, // Use first token latency as the latency metric
		}
	}

	override getModel() {
		const id = this.options.openAiModelId ?? ""
		const info = this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const isAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)
			const model = this.getModel()
			const modelInfo = model.info

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: model.id,
				messages: [{ role: "user", content: prompt }],
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let response
			try {
				response = await this.client.chat.completions.create(
					requestOptions,
					isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`${this.providerName} completion error: ${error.message}`)
			}

			throw error
		}
	}

	private async *handleO3FamilyMessage(
		modelId: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		tools?: OpenAI.ChatCompletionTool[],
	): ApiStream {
		const modelInfo = this.getModel().info
		const methodIsAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)

		if (this.options.openAiStreamingEnabled ?? true) {
			const isGrokXAI = this._isGrokXAI(this.options.openAiBaseUrl)

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: modelId,
				messages: [
					{
						role: "developer",
						content: `Formatting re-enabled\n${systemPrompt}`,
					},
					...convertToOpenAiMessages(messages),
				],
				stream: true,
				...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
				...(tools && tools.length > 0 ? { tools } : {}),
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let stream
			try {
				stream = await this.client.chat.completions.create(
					requestOptions,
					methodIsAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			yield* this.handleStreamResponse(stream)
		} else {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [
					{
						role: "developer",
						content: `Formatting re-enabled\n${systemPrompt}`,
					},
					...convertToOpenAiMessages(messages),
				],
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
				...(tools && tools.length > 0 ? { tools } : {}),
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			let response
			try {
				response = await this.client.chat.completions.create(
					requestOptions,
					methodIsAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
				)
			} catch (error) {
				throw handleOpenAIError(error, this.providerName)
			}

			const message = response.choices[0]?.message
			let content = message?.content || ""

			// Handle tool calls in O3 non-streaming response
			if (message?.tool_calls && message.tool_calls.length > 0) {
				for (const toolCall of message.tool_calls) {
					if ('function' in toolCall && toolCall.function && toolCall.function.name && toolCall.function.arguments) {
						try {
							const tool: ApiStreamToolChunk = {
								type: "tool",
								tool_call_id: toolCall.id,
								name: toolCall.function.name,
								params: JSON.parse(toolCall.function.arguments)
							}
							yield tool
						} catch (error) {
							throw new Error(`Tool call JSON parsing failed: ${error}`)
						}
					}
				}
			}

			yield {
				type: "text",
				text: content,
			}
			yield this.processUsageMetrics(response.usage)
		}
	}

	private async *handleStreamResponse(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): ApiStream {
		let startTime = Date.now()
		let firstTokenTime: number | null = null
		let hasFirstToken = false
		let lastUsage

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				// Record first token
				if (!hasFirstToken && delta.content.trim()) {
					firstTokenTime = Date.now()
					hasFirstToken = true
				}

				yield {
					type: "text",
					text: delta.content,
				}
			}

			// Handle tool calls in stream response
			if (delta?.tool_calls && delta.tool_calls.length > 0) {
				for (const toolCall of delta.tool_calls) {
					if ('function' in toolCall && toolCall.function && toolCall.function.name && toolCall.function.arguments) {
						try {
							const tool: ApiStreamToolChunk = {
								type: "tool",
								tool_call_id: toolCall.id,
								name: toolCall.function.name,
								params: JSON.parse(toolCall.function.arguments)
							}
							yield tool
						} catch (error) {
							throw new Error(`Tool call JSON parsing failed: ${error}`)
						}
					}
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

			yield this.processUsageMetrics(enhancedUsage)
		}
	}

	private _getUrlHost(baseUrl?: string): string {
		try {
			return new URL(baseUrl ?? "").host
		} catch (error) {
			return ""
		}
	}

	private _isGrokXAI(baseUrl?: string): boolean {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.includes("x.ai")
	}

	private _isAzureAiInference(baseUrl?: string): boolean {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.endsWith(".services.ai.azure.com")
	}

	/**
	 * Adds max_completion_tokens to the request body if needed based on provider configuration
	 * Note: max_tokens is deprecated in favor of max_completion_tokens as per OpenAI documentation
	 * O3 family models handle max_tokens separately in handleO3FamilyMessage
	 */
	protected addMaxTokensIfNeeded(
		requestOptions:
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
		modelInfo: ModelInfo,
	): void {
		// Only add max_completion_tokens if includeMaxTokens is true
		if (this.options.includeMaxTokens === true) {
			// Use user-configured modelMaxTokens if available, otherwise fall back to model's default maxTokens
			// Using max_completion_tokens as max_tokens is deprecated
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}
	}
}

export async function getOpenAiModels(baseUrl?: string, apiKey?: string, openAiHeaders?: Record<string, string>) {
	try {
		if (!baseUrl) {
			return []
		}

		// Trim whitespace from baseUrl to handle cases where users accidentally include spaces
		const trimmedBaseUrl = baseUrl.trim()

		if (!URL.canParse(trimmedBaseUrl)) {
			return []
		}

		const config: Record<string, any> = {}
		const headers: Record<string, string> = {
			...DEFAULT_HEADERS,
			...(openAiHeaders || {}),
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		if (Object.keys(headers).length > 0) {
			config["headers"] = headers
		}

		const response = await axios.get(`${trimmedBaseUrl}/models`, config)
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		return [...new Set<string>(modelsArray)]
	} catch (error) {
		return []
	}
}
