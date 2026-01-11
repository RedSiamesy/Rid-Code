import { useState } from "react"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"
import { ChevronUp, Pin } from "lucide-react"

import type { ContextCondense } from "@roo-code/types"

import { Markdown } from "./Markdown"
import { ProgressIndicator } from "./ProgressIndicator"
import { ToolUseBlock } from "../common/ToolUseBlock"

export const SaveMemoryRow = ({ cost, summary }: ContextCondense) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const displayCost = cost ?? 0

	return (
		<div className="group flex flex-col gap-2 opacity-40 hover:opacity-80 transition-opacity duration-300">
			<div
				className="flex items-center justify-between cursor-pointer select-none"
				onClick={() => setIsExpanded(!isExpanded)}>
				<Pin className="w-4 shrink-0" aria-label="Memory icon" style={{ color: "#00a3af" }} />
				<div className="flex items-center gap-2 flex-grow">
					<span className="font-bold text-vscode-foreground" style={{ color: "#00a3af" }}>
						Memory saved
					</span>
					<VSCodeBadge className={displayCost > 0 ? "opacity-100" : "opacity-0"}>
						${displayCost.toFixed(2)}
					</VSCodeBadge>
				</div>
				<ChevronUp
					className={`w-4 transition-transform duration-200 opacity-0 group-hover:opacity-100 ${
						isExpanded ? "" : "-rotate-180"
					}`}
				/>
			</div>

			{isExpanded && (
				<div className="pl-6 pr-1">
					<ToolUseBlock>
						<Markdown markdown={summary} partial={false} />
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
			<span className="font-bold text-vscode-foreground" style={{ color: "#00a3af99" }}>
				Saving memory...
			</span>
		</div>
	)
}

export const SaveMemoryErrorRow = ({ errorText }: { errorText?: string }) => {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<span className="codicon codicon-warning text-vscode-editorWarning-foreground opacity-80 text-base -mb-0.5"></span>
				<span className="font-bold text-vscode-foreground">Memory save failed</span>
			</div>
			{errorText && <span className="text-vscode-descriptionForeground text-sm">{errorText}</span>}
		</div>
	)
}
