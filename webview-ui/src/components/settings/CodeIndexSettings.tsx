import React, { useState, useEffect } from "react"
import { z } from "zod"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { VSCodeCheckbox, VSCodeTextField, VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"

import { CodebaseIndexConfig, CodebaseIndexModels, ProviderSettings } from "@roo-code/types"

import { EmbedderProvider } from "@roo/embeddingModels"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@src/utils/docLinks"

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@src/components/ui"

import { SetCachedStateField } from "./types"

interface CodeIndexSettingsProps {
	codebaseIndexModels: CodebaseIndexModels | undefined
	codebaseIndexConfig: CodebaseIndexConfig | undefined
	apiConfiguration: ProviderSettings
	setCachedStateField: SetCachedStateField<"codebaseIndexConfig">
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
	areSettingsCommitted: boolean
}

import type { IndexingStatusUpdateMessage } from "@roo/ExtensionMessage"

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({
	codebaseIndexModels,
	codebaseIndexConfig,
	apiConfiguration,
	setCachedStateField,
	setApiConfigurationField,
	areSettingsCommitted,
}) => {
	const { t } = useAppTranslation()
	const [indexingStatus, setIndexingStatus] = useState({
		systemStatus: "Standby",
		message: "",
		processedItems: 0,
		totalItems: 0,
		currentItemUnit: "items",
	})

	// Safely calculate available models for current provider
	const currentProvider = codebaseIndexConfig?.codebaseIndexEmbedderProvider
	const modelsForProvider =
		currentProvider === "openai" || currentProvider === "ollama" || currentProvider === "openai-compatible"
			? codebaseIndexModels?.[currentProvider] || codebaseIndexModels?.openai
			: codebaseIndexModels?.openai
	const availableModelIds = Object.keys(modelsForProvider || {})

	useEffect(() => {
		// Request initial indexing status from extension host
		vscode.postMessage({ type: "requestIndexingStatus" })

		// Set up interval for periodic status updates

		// Set up message listener for status updates
		const handleMessage = (event: MessageEvent<IndexingStatusUpdateMessage>) => {
			if (event.data.type === "indexingStatusUpdate") {
				setIndexingStatus({
					systemStatus: event.data.values.systemStatus,
					message: event.data.values.message || "",
					processedItems: event.data.values.processedItems,
					totalItems: event.data.values.totalItems,
					currentItemUnit: event.data.values.currentItemUnit || "items",
				})
			}
		}

		window.addEventListener("message", handleMessage)

		// Cleanup function
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [codebaseIndexConfig, codebaseIndexModels])

	/**
	 * Determines the appropriate model ID when changing providers
	 */
	function getModelIdForProvider(
		newProvider: EmbedderProvider,
		currentProvider: EmbedderProvider | undefined,
		currentModelId: string | undefined,
		availableModels: CodebaseIndexModels | undefined,
	): string {
		if (newProvider === currentProvider && currentModelId) {
			return currentModelId
		}

		const models = availableModels?.[newProvider]
		const modelIds = models ? Object.keys(models) : []

		if (currentModelId && modelIds.includes(currentModelId)) {
			return currentModelId
		}

		const selectedModel = modelIds.length > 0 ? modelIds[0] : ""
		return selectedModel
	}

	function validateIndexingConfig(config: CodebaseIndexConfig | undefined, apiConfig: ProviderSettings): boolean {
		if (!config) return false

		if (!config.embeddingBaseUrl) return false
		return true

		// const baseSchema = z.object({
		// 	codebaseIndexQdrantUrl: z.string().url("Qdrant URL must be a valid URL"),
		// 	codebaseIndexEmbedderModelId: z.string().min(1, "Model ID is required"),
		// })

		// const providerSchemas = {
		// 	openai: baseSchema.extend({
		// 		codebaseIndexEmbedderProvider: z.literal("openai"),
		// 		codeIndexOpenAiKey: z.string().min(1, "OpenAI key is required"),
		// 	}),
		// 	ollama: baseSchema.extend({
		// 		codebaseIndexEmbedderProvider: z.literal("ollama"),
		// 		codebaseIndexEmbedderBaseUrl: z.string().url("Ollama URL must be a valid URL"),
		// 	}),
		// 	"openai-compatible": baseSchema.extend({
		// 		codebaseIndexEmbedderProvider: z.literal("openai-compatible"),
		// 		codebaseIndexOpenAiCompatibleBaseUrl: z.string().url("Base URL must be a valid URL"),
		// 		codebaseIndexOpenAiCompatibleApiKey: z.string().min(1, "API key is required"),
		// 		codebaseIndexOpenAiCompatibleModelDimension: z
		// 			.number()
		// 			.int("Dimension must be an integer")
		// 			.positive("Dimension must be a positive number")
		// 			.optional(),
		// 	}),
		// }

		// try {
		// 	const schema =
		// 		config.codebaseIndexEmbedderProvider === "openai"
		// 			? providerSchemas.openai
		// 			: config.codebaseIndexEmbedderProvider === "ollama"
		// 				? providerSchemas.ollama
		// 				: providerSchemas["openai-compatible"]

		// 	schema.parse({
		// 		...config,
		// 		codeIndexOpenAiKey: apiConfig.codeIndexOpenAiKey,
		// 		codebaseIndexOpenAiCompatibleBaseUrl: apiConfig.codebaseIndexOpenAiCompatibleBaseUrl,
		// 		codebaseIndexOpenAiCompatibleApiKey: apiConfig.codebaseIndexOpenAiCompatibleApiKey,
		// 		codebaseIndexOpenAiCompatibleModelDimension: apiConfig.codebaseIndexOpenAiCompatibleModelDimension,
		// 	})
		// 	return true
		// } catch {
		// 	return false
		// }
	}

	const progressPercentage =
		indexingStatus.totalItems > 0
			? (indexingStatus.processedItems / indexingStatus.totalItems) * 100
			: indexingStatus.totalItems === 0 && indexingStatus.processedItems === 0
				? 100
				: 0

	const transformValue = 100 - progressPercentage
	const transformStyleString = `translateX(-${transformValue}%)`

	return (
		<>
			<div>
				<div className="flex items-center gap-2">
					<VSCodeCheckbox
						checked={codebaseIndexConfig?.codebaseIndexEnabled}
						onChange={(e: any) =>
							setCachedStateField("codebaseIndexConfig", {
								...codebaseIndexConfig,
								codebaseIndexEnabled: e.target.checked,
							})
						}>
						<span className="font-medium">{t("settings:codeIndex.enableLabel")}</span>
					</VSCodeCheckbox>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					<Trans i18nKey="settings:codeIndex.enableDescription">
						<VSCodeLink
							href={buildDocLink("features/experimental/codebase-indexing", "settings")}
							style={{ display: "inline" }}></VSCodeLink>
					</Trans>
				</p>
			</div>

			{codebaseIndexConfig?.codebaseIndexEnabled && (
				<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
					<div className="text-sm text-vscode-descriptionForeground">
						<span
							className={`
								inline-block w-3 h-3 rounded-full mr-2
								${
									indexingStatus.systemStatus === "Standby"
										? "bg-gray-400"
										: indexingStatus.systemStatus === "Indexing"
											? "bg-yellow-500 animate-pulse"
											: indexingStatus.systemStatus === "Indexed"
												? "bg-green-500"
												: indexingStatus.systemStatus === "Error"
													? "bg-red-500"
													: "bg-gray-400"
								}
							`}></span>
						{indexingStatus.systemStatus}
						{indexingStatus.message ? ` - ${indexingStatus.message}` : ""}
					</div>

					{indexingStatus.systemStatus === "Indexing" && (
						<div className="space-y-1">
							<ProgressPrimitive.Root
								className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
								value={progressPercentage}>
								<ProgressPrimitive.Indicator
									className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-in-out"
									style={{
										transform: transformStyleString,
									}}
								/>
							</ProgressPrimitive.Root>
						</div>
					)}

					<div className="flex items-center gap-4 font-bold">
						<div>{t("settings:codeIndex.providerLabel")}</div>
					</div>
					<div>
						<div className="flex items-center gap-2">
							<Select
								value={codebaseIndexConfig?.codebaseIndexEmbedderProvider || "openai"}
								onValueChange={(value) => {
									const newProvider = value as EmbedderProvider
									const currentProvider = codebaseIndexConfig?.codebaseIndexEmbedderProvider
									const currentModelId = codebaseIndexConfig?.codebaseIndexEmbedderModelId

									const modelIdToUse = getModelIdForProvider(
										newProvider,
										currentProvider,
										currentModelId,
										codebaseIndexModels,
									)

									if (codebaseIndexConfig) {
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											codebaseIndexEmbedderProvider: newProvider,
											codebaseIndexEmbedderModelId: modelIdToUse,
										})
									}
								}}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t("settings:codeIndex.selectProviderPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="openai-compatible">
										{t("settings:codeIndex.openaiCompatibleProvider")}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "openai-compatible" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{"基础 URL"}</div>
							</div>
							<div>
								<VSCodeTextField
									value={codebaseIndexConfig.embeddingBaseUrl || ""}
									onInput={(e: any) =>
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											embeddingBaseUrl: e.target.value,
										})
									}
									style={{ width: "100%" }}>
								</VSCodeTextField>
								<p className="text-vscode-descriptionForeground text-sm mt-1">
									{"使用嵌入模型对源文件片段进行向量化"}
								</p>
							</div>
							<div className="flex items-center gap-4 font-bold">
								<div>{"API 密钥"}</div>
							</div>
							<div>
								<VSCodeTextField
									type="password"
									value={apiConfiguration.embeddingApiKey || ""}
									onInput={(e: any) =>
										setApiConfigurationField("embeddingApiKey", e.target.value)
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
							<div className="flex items-center gap-4 font-bold">
								<div>{"模型 ID"}</div>
							</div>
							<div>
								<VSCodeTextField
									value={codebaseIndexConfig.embeddingModelID || ""}
									onInput={(e: any) =>
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											embeddingModelID: e.target.value,
										})
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "openai-compatible" && (
						<div className="mt-8">
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-0 font-bold">
								<div>{"注解基础 URL"}</div>
								<p className="text-vscode-descriptionForeground m-0">{"（选填）"}</p>
							</div>
							<div>
								<VSCodeTextField
									value={codebaseIndexConfig.enhancementBaseUrl || ""}
									onInput={(e: any) =>
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											enhancementBaseUrl: e.target.value,
										})
									}
									style={{ width: "100%" }}>
								</VSCodeTextField>
								<p className="text-vscode-descriptionForeground text-sm mt-1">
									{"使用对话模型对源文件片段进行注解，帮助 Codebase Search 搜索代码上下文，也使用于 LLM 重排序"}
								</p>
							</div>
							<div className="flex items-center gap-0 font-bold">
								<div>{"注解 API 密钥"}</div>
								<p className="text-vscode-descriptionForeground m-0">{"（选填）"}</p>
							</div>
							<div>
								<VSCodeTextField
									type="password"
									value={apiConfiguration.enhancementApiKey || ""}
									onInput={(e: any) =>
										setApiConfigurationField("enhancementApiKey", e.target.value)
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
							<div className="flex items-center gap-0 font-bold">
								<div>{"注解模型 ID"}</div>
								<p className="text-vscode-descriptionForeground m-0">{"（选填）"}</p>
							</div>
							<div>
								<VSCodeTextField
									value={codebaseIndexConfig.enhancementModelID || ""}
									onInput={(e: any) =>
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											enhancementModelID: e.target.value,
										})
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
						</div>
					)}

					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "openai-compatible" && (
						<div className="mt-8">
							<div className="flex flex-col gap-3">
								<div className="flex items-center gap-0 font-bold">
									<div>{"存放位置"}</div>
									<p className="text-vscode-descriptionForeground m-0">{"（选填）"}</p>
								</div>
								<div>
									<VSCodeTextField
										value={codebaseIndexConfig.ragPath || ""}
										onInput={(e: any) =>
											setCachedStateField("codebaseIndexConfig", {
												...codebaseIndexConfig,
												ragPath: e.target.value,
											})
										}
										style={{ width: "100%" }}>
									</VSCodeTextField>
									<p className="text-vscode-descriptionForeground text-sm mt-0">
										{"向量数据库仅支持存放在本地硬盘，不支持存放在网络硬盘"}
									</p>
								</div>
							</div>
							<div className="flex flex-col gap-3">
								<div className="flex items-center gap-2">
									<VSCodeCheckbox
										checked={codebaseIndexConfig?.llmFilter || false}
										onChange={(e: any) =>
											setCachedStateField("codebaseIndexConfig", {
												...codebaseIndexConfig,
												llmFilter: e.target.checked,
											})
										}>
										<span className="font-medium">{"启用 LLM 重排序"}</span>
									</VSCodeCheckbox>
								</div>
								<p className="text-vscode-descriptionForeground text-sm mt-0">
									{"使用对话模型对搜索结果进行筛选，提高检索准确性"}
								</p>
							</div>
							<div className="flex flex-col gap-3">
								<div className="flex items-center gap-2">
									<VSCodeCheckbox
										checked={codebaseIndexConfig?.codeBaseLogging || false}
										onChange={(e: any) =>
											setCachedStateField("codebaseIndexConfig", {
												...codebaseIndexConfig,
												codeBaseLogging: e.target.checked,
											})
										}>
										<span className="font-medium">{"启用代码库日志记录"}</span>
									</VSCodeCheckbox>
								</div>
							</div>
						</div>
					)}


					{/* {codebaseIndexConfig?.codebaseIndexEmbedderProvider === "openai-compatible" && (
						<div className="mt-8">
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-0 font-bold">
								<div>{"重排序基础 URL"}</div>
								<p className="text-vscode-descriptionForeground m-0">{"（选填）"}</p>
							</div>
							<div>
								<VSCodeTextField
									value={codebaseIndexConfig.rerankBaseUrl || ""}
									onInput={(e: any) =>
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											rerankBaseUrl: e.target.value,
										})
									}
									style={{ width: "100%" }}>
								</VSCodeTextField>
								<p className="text-vscode-descriptionForeground text-sm mt-1">
									{"对 Codebase Search 搜索出的候选文档进行更精细的排序，从而提升检索结果的准确性"}
								</p>
							</div>
							<div className="flex items-center gap-0 font-bold">
								<div>{"重排序 API 密钥"}</div>
								<p className="text-vscode-descriptionForeground m-0">{"（选填）"}</p>
							</div>
							<div>
								<VSCodeTextField
									type="password"
									value={apiConfiguration.rerankApiKey || ""}
									onInput={(e: any) =>
										setApiConfigurationField("rerankApiKey", e.target.value)
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
							<div className="flex items-center gap-0 font-bold">
								<div>{"重排序模型 ID"}</div>
								<p className="text-vscode-descriptionForeground m-0">{"（选填）"}</p>
							</div>
							<div>
								<VSCodeTextField
									value={codebaseIndexConfig.rerankModelID || ""}
									onInput={(e: any) =>
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											rerankModelID: e.target.value,
										})
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
						</div>
					)} */}

					{(!areSettingsCommitted || !validateIndexingConfig(codebaseIndexConfig, apiConfiguration)) && (
						<p className="text-sm text-vscode-descriptionForeground mb-2">
							{t("settings:codeIndex.unsavedSettingsMessage")}
						</p>
					)}

					<div className="flex gap-2">
						{(indexingStatus.systemStatus === "Error" || indexingStatus.systemStatus === "Standby") && (
							<VSCodeButton
								onClick={() => vscode.postMessage({ type: "startIndexing" })}
								disabled={
									!areSettingsCommitted ||
									!validateIndexingConfig(codebaseIndexConfig, apiConfiguration)
								}>
								{t("settings:codeIndex.startIndexingButton")}
							</VSCodeButton>
						)}
						{(indexingStatus.systemStatus === "Indexed" || indexingStatus.systemStatus === "Error") && (
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<VSCodeButton appearance="secondary">
										{t("settings:codeIndex.clearIndexDataButton")}
									</VSCodeButton>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											{t("settings:codeIndex.clearDataDialog.title")}
										</AlertDialogTitle>
										<AlertDialogDescription>
											{t("settings:codeIndex.clearDataDialog.description")}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>
											{t("settings:codeIndex.clearDataDialog.cancelButton")}
										</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => vscode.postMessage({ type: "clearIndexData" })}>
											{t("settings:codeIndex.clearDataDialog.confirmButton")}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						)}
					</div>
				</div>
			)}
		</>
	)
}
