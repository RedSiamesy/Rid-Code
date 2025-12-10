import { useState } from "react"
import { useTranslation } from "react-i18next"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"

import type { ContextCondense } from "@roo-code/types"

import { Markdown } from "./Markdown"
import { ProgressIndicator } from "./ProgressIndicator"
import {
	Pin,
	ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { ToolUseBlock, ToolUseBlockHeader } from "../common/ToolUseBlock"

export const SaveMemoryRow = ({ cost, prevContextTokens, newContextTokens, summary }: ContextCondense) => {
	const { t } = useTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	return (
		<div className="group flex flex-col gap-2 opacity-30 hover:opacity-80 transition-opacity duration-300">
			<div
				className="flex items-center justify-between cursor-pointer select-none"
				onClick={() => setIsExpanded(!isExpanded)}>
				<Pin className="w-4 shrink-0" aria-label="Memory icon" style={{  color: "#00a3afff", }} />
				<div className="flex items-center gap-2 flex-grow">
					<span className="codicon codicon-compress text-blue-400" />
					<span className="font-bold text-vscode-foreground" style={{  color: "#00a3afff", fontWeight: "bold" }}>{"已保存记忆"}</span>
					{/* <span className="text-vscode-descriptionForeground text-sm">
						{prevContextTokens.toLocaleString()} → {newContextTokens.toLocaleString()} {t("tokens")}
					</span> */}
					<VSCodeBadge className={cost > 0 ? "opacity-100" : "opacity-0"}>${cost.toFixed(2)}</VSCodeBadge>
				</div>
				{/* <span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span> */}
				<div className="flex items-center gap-2">
					<ChevronUp
						className={cn(
							"w-4 transition-all opacity-0 group-hover:opacity-100",
							!isExpanded && "-rotate-180",
						)}
					/>
				</div>
			</div>

			{isExpanded && (
				<div className="pl-6 pr-1">
					<ToolUseBlock>
						<Markdown markdown={summary} partial={false}/>
					</ToolUseBlock>
				</div>
			)}
		</div>
	)
}

export const SavingMemoryRow = () => {
	return (
		<div className="flex items-center gap-2">
			<ProgressIndicator />
			<span className="codicon codicon-compress text-blue-400" />
			<span className="font-bold text-vscode-foreground"  style={{  color: "#00a3af77", fontWeight: "bold" }}>{"正在分析记忆数据..."}</span>
		</div>
	)
}

export const SaveMemoryErrorRow = ({ errorText }: { errorText?: string }) => {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<span className="codicon codicon-warning text-vscode-editorWarning-foreground opacity-80 text-base -mb-0.5"></span>
				<span className="font-bold text-vscode-foreground">{"保存记忆错误"}</span>
			</div>
			<span className="text-vscode-descriptionForeground text-sm">{errorText}</span>
		</div>
	)
}