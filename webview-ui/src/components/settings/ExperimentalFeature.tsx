import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface ExperimentalFeatureProps {
	enabled: boolean
	onChange: (value: boolean) => void
	// Additional property to identify the experiment
	experimentKey?: string
}

export const ExperimentalFeature = ({ enabled, onChange, experimentKey }: ExperimentalFeatureProps) => {
	const { t } = useAppTranslation()

	// Generate translation keys based on experiment key
	const nameKey = experimentKey ? `settings:experimental.${experimentKey}.name` : ""
	const descriptionKey = experimentKey ? `settings:experimental.${experimentKey}.description` : ""

	// Hardcoded description for USE_NATIVE_PROMPT experiment
	const key = experimentKey === "USE_NATIVE_PROMPT" ? "使用原生提示词" : ""
	const hardcodedDescription = experimentKey === "USE_NATIVE_PROMPT" ? "启用后，Roo 将使用原生提示系统而不是claude code提示生成器。" : ""

	return (
		<div>
			<div className="flex items-center gap-2">
				<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
					<span className="font-medium">{key || t(nameKey)}</span>
				</VSCodeCheckbox>
			</div>
			<p className="text-vscode-descriptionForeground text-sm mt-0">{hardcodedDescription || t(descriptionKey)}</p>
		</div>
	)
}
