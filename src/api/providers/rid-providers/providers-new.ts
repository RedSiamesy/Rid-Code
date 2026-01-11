import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import axios from "axios"

import {
    type ModelInfo,
    openAiModelInfoSaneDefaults,
    NATIVE_TOOL_DEFAULTS,
    ModelRecord,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { XmlMatcher } from "../../../utils/xml-matcher"

import { convertToOpenAiMessages } from "../../transform/openai-format"
import { ApiStream, ApiStreamUsageChunk } from "../../transform/stream"
import { getModelParams } from "../../transform/model-params"

import { DEFAULT_HEADERS } from "../constants"
import { BaseProvider } from "../base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../../index"
import { getApiRequestTimeout } from "../utils/timeout-config"
import { handleOpenAIError } from "../utils/openai-error-handler"

import { chatCompletions_Stream, chatCompletions_NonStream } from "./tools"

// TODO: Rename this to OpenAICompatibleHandler. Also, I think the
// `OpenAINativeHandler` can subclass from this, since it's obviously
// compatible with the OpenAI API. We can also rename it to `OpenAIHandler`.
export class RiddlerHandler extends BaseProvider implements SingleCompletionHandler {
    protected options: ApiHandlerOptions
    protected client: OpenAI
    private readonly providerName = "RidOpenAI"
    protected models: ModelRecord = {}

    constructor(options: ApiHandlerOptions) {
        super()
        this.options = options

        const baseURL = this.options.openAiBaseUrl ?? "https://api.openai.com/v1"
        const apiKey = this.options.openAiApiKey ?? "not-provided"
        const headers = {
            ...DEFAULT_HEADERS,
            ...(this.options.openAiHeaders || {}),
        }

        const timeout = getApiRequestTimeout()

        this.client = new OpenAI({
            baseURL,
            apiKey,
            defaultHeaders: headers,
            timeout,
        })
    }

    override async *createMessage(
        systemPrompt: string,
        messages: Anthropic.Messages.MessageParam[],
        metadata?: ApiHandlerCreateMessageMetadata,
    ): ApiStream {
        const { info: modelInfo, reasoning } = this.getModel()
        const modelId = this.options.openAiModelId ?? ""
        // if (this.options.openAiStreamingEnabled ?? true) {
        if (true) {
            let systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
                role: "system",
                content: systemPrompt,
            }
            let convertedMessages

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

            const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
                model: modelId,
                temperature: this.options.modelTemperature ?? 0,
                messages: convertedMessages,
                stream: true as const,
                ...(reasoning && reasoning),
                ...(metadata?.tools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
                ...(metadata?.tool_choice && { tool_choice: metadata.tool_choice }),
                ...(metadata?.toolProtocol === "native" && {
                    parallel_tool_calls: metadata.parallelToolCalls ?? false,
                }),
            }

            // Add max_tokens if needed
            this.addMaxTokensIfNeeded(requestOptions, modelInfo)

            let stream
            try {
                stream = await chatCompletions_Stream(this.client, requestOptions)
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
            let startTime = Date.now()
			let firstTokenTime: number | null = null
			let hasFirstToken = false

            const activeToolCallIds = new Set<string>()

            for await (const chunk of stream) {
                const delta = chunk.choices?.[0]?.delta ?? {}
                const finishReason = chunk.choices?.[0]?.finish_reason
                // Record first token time
                if (!hasFirstToken && 
                    (
                        ("reasoning_content" in delta && delta.reasoning_content && (delta.reasoning_content as string)?.trim())
                        || (delta.content && delta.content.trim()) 
                        || (delta.tool_calls && delta.tool_calls.length > 0)
                    )
                ) {
                    firstTokenTime = Date.now()
                    hasFirstToken = true
                }

                if (delta.content) {

                    for (const chunk of matcher.update(delta.content)) {
                        yield chunk
                    }
                }

                if ("reasoning_content" in delta && delta.reasoning_content) {

                    if (hasFirstToken) {
                        yield {
                            type: "reasoning",
                            text: (delta.reasoning_content as string | undefined) || "",
                        }
                    }
                }

                yield* this.processToolCalls(delta, finishReason, activeToolCallIds)

                if (chunk.usage) {
                    lastUsage = chunk.usage
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
			cacheWriteTokens: usage?.prompt_tokens_details?.cache_miss_tokens,
			cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens,
			tps: tps,
			latency: firstTokenLatency, // Use first token latency as the latency metric
		}
    }

    override getModel() {
		const id = this.options.openAiModelId ?? ""
		// Ensure OpenAI-compatible models default to supporting native tool calling.
		// This is required for [`Task.attemptApiRequest()`](src/core/task/Task.ts:3817) to
		// include tool definitions in the request.
		const info: ModelInfo = {
			...NATIVE_TOOL_DEFAULTS,
			...(this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults),
		}
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

    async completePrompt(prompt: string): Promise<string> {
        try {
            const model = this.getModel()
            const modelInfo = model.info

            const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
                model: model.id,
                messages: [{ role: "user", content: prompt }],
            }

            // Add max_tokens if needed
            this.addMaxTokensIfNeeded(requestOptions, modelInfo)

            try {

                const content = await chatCompletions_NonStream(this.client, requestOptions)

			    return content || ""
            } catch (error) {
                throw handleOpenAIError(error, this.providerName)
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`${this.providerName} completion error: ${error.message}`)
            }

            throw error
        }
    }

    /**
     * Helper generator to process tool calls from a stream chunk.
     * Tracks active tool call IDs and yields tool_call_partial and tool_call_end events.
     * @param delta - The delta object from the stream chunk
     * @param finishReason - The finish_reason from the stream chunk
     * @param activeToolCallIds - Set to track active tool call IDs (mutated in place)
     */
    private *processToolCalls(
        delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta | undefined,
        finishReason: string | null | undefined,
        activeToolCallIds: Set<string>,
    ): Generator<
        | { type: "tool_call_partial"; index: number; id?: string; name?: string; arguments?: string }
        | { type: "tool_call_end"; id: string }
    > {
        if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
                if (toolCall.id) {
                    activeToolCallIds.add(toolCall.id)
                }
                yield {
                    type: "tool_call_partial",
                    index: toolCall.index,
                    id: toolCall.id,
                    name: toolCall.function?.name,
                    arguments: toolCall.function?.arguments,
                }
            }
        }

        // Emit tool_call_end events when finish_reason is "tool_calls"
        // This ensures tool calls are finalized even if the stream doesn't properly close
        if (finishReason === "tool_calls" && activeToolCallIds.size > 0) {
            for (const id of activeToolCallIds) {
                yield { type: "tool_call_end", id }
            }
            activeToolCallIds.clear()
        }
    }

    protected _getUrlHost(baseUrl?: string): string {
        try {
            return new URL(baseUrl ?? "").host
        } catch (error) {
            return ""
        }
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
