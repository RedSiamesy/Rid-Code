import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type SiliconFlowProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const SiliconFlow = ({ apiConfiguration, setApiConfigurationField }: SiliconFlowProps) => {
	const { t } = useAppTranslation()

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.siliconFlowApiKey || ""}
				type="password"
				onInput={handleInputChange("siliconFlowApiKey")}
				placeholder={"SiliconFlow API 密钥"}
				className="w-full">
				<label className="block font-medium mb-1">{"SiliconFlow API 密钥"}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{/* {!apiConfiguration?.siliconFlowApiKey && (
				<VSCodeButtonLink href="https://cloud.siliconflow.cn/" appearance="secondary">
					获取 SiliconFlow API 密钥
				</VSCodeButtonLink>
			)} */}
		</>
	)
}