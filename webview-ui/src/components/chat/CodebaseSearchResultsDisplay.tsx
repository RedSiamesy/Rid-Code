import React, { useState } from "react"
import CodebaseSearchResult from "./CodebaseSearchResult"
import { Trans } from "react-i18next"

import {
	ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CodebaseSearchResultsDisplayProps {
	results: Array<{
		filePath: string
		score: number
		startLine: number
		endLine: number
		codeChunk: string
	}>
}

const CodebaseSearchResultsDisplay: React.FC<CodebaseSearchResultsDisplayProps> = ({ results }) => {
	const [codebaseSearchResultsExpanded, setCodebaseSearchResultsExpanded] = useState(false)

	return (
		<div className="group flex flex-col -mt-4 gap-1">
			<div
				onClick={() => setCodebaseSearchResultsExpanded(!codebaseSearchResultsExpanded)}
				className="rounded-md p-2 cursor-pointer bg-vscode-list-hoverBackground/50  hover:bg-vscode-list-hoverBackground/70 transition-colors duration-300 cursor-pointer flex items-center justify-between px-2 py-2 bg-[var(--vscode-editor-background)]">
				<span className="flex items-center">
					<span className={`center codicon codicon-output mr-1.5`} />
					<div className="pl-1">
						<Trans
							i18nKey="chat:codebaseSearch.didSearch"
							count={results.length}
							values={{ count: results.length }}
						/>
					</div>
				</span>
				<ChevronUp
						className={cn(
							"w-4 transition-all opacity-0 group-hover:opacity-100",
							!codebaseSearchResultsExpanded && "-rotate-180",
						)}
					/>
				{/* <span className={`codicon codicon-chevron-${codebaseSearchResultsExpanded ? "up" : "down"} opacity-0 hover:opacity-100`}></span> */}
			</div>

			{codebaseSearchResultsExpanded && (
				<div className="flex flex-col gap-1">
					{results.map((result, idx) => (
						<CodebaseSearchResult
							key={idx}
							filePath={result.filePath}
							score={result.score}
							startLine={result.startLine}
							endLine={result.endLine}
							language="plaintext"
							snippet={result.codeChunk}
						/>
					))}
				</div>
			)}
		</div>
	)
}

export default CodebaseSearchResultsDisplay
