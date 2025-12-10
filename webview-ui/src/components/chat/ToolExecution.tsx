import { useCallback, useState, memo, useEffect, useMemo } from "react"
import { Wrench, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useEvent } from "react-use"

import { cn } from "@src/lib/utils"
import { Button } from "@src/components/ui"
import CodeBlock from "../common/CodeBlock"
import { Markdown } from "./Markdown"
import { ToolExecutionStatus } from "@roo-code/types"
import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { safeJsonParse } from "../../../../src/shared/safeJsonParse"

export interface ToolParameter {
	name: string
	value: string
	label?: string
}

interface ToolExecutionProps {
	executionId?: string
	toolName: string
	toolDisplayName?: string
	parameters?: ToolParameter[]
	response?: string
	isPartial?: boolean
	status?: "executing" | "completed" | "error"
	error?: string
	className?: string
}

export const ToolExecution = ({
	executionId,
	toolName,
	toolDisplayName,
	parameters = [],
	response: initialResponse,
	isPartial = false,
	status: initialStatus,
	error: initialError,
	className,
}: ToolExecutionProps) => {
	const { t } = useTranslation()

	// State for tracking tool response status (similar to MCP)
	const [status, setStatus] = useState<ToolExecutionStatus | null>(
		initialStatus ? {
			executionId: executionId || "",
			status: initialStatus === "executing" ? "started" : initialStatus,
			toolName,
			response: initialResponse,
			error: initialError,
		} : null
	)
	const [responseText, setResponseText] = useState(initialResponse || "")

	// Only need expanded state for response section
	const [isResponseExpanded, setIsResponseExpanded] = useState(false)

	// Listen for tool execution status messages (similar to MCP execution status)
	const onMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data
			console.log('event', event);

			if (message.type === "toolExecutionStatus") {
				try {
					const data = safeJsonParse<ToolExecutionStatus>(message.text || "{}", {
						executionId: "",
						status: "started",
						toolName: "",
					})
					console.log('data', data);
					console.log('executionId', executionId);
					// Only update if this message is for our execution and data is valid
					if (data && data.executionId === executionId) {
						setStatus(data)

						if (data.status === "output" && data.response) {
							setResponseText(data.response)
						} else if (data.status === "completed" && data.response) {
							setResponseText(data.response)
						}
					}
				} catch (e) {
					console.error("Failed to parse tool execution status", e)
				}
			}
		},
		[executionId],
	)

	useEvent("message", onMessage)

	// Initialize response text from props
	useEffect(() => {
		if (initialResponse) {
			setResponseText(initialResponse)
		}
	}, [initialResponse])

	const onToggleResponseExpand = useCallback(() => {
		setIsResponseExpanded(!isResponseExpanded)
	}, [isResponseExpanded])

	// Try to parse JSON and return both the result and formatted text
	const tryParseJson = useCallback((text: string): { isJson: boolean; formatted: string } => {
		if (!text) return { isJson: false, formatted: "" }

		try {
			const parsed = JSON.parse(text)
			return {
				isJson: true,
				formatted: JSON.stringify(parsed, null, 2),
			}
		} catch {
			return {
				isJson: false,
				formatted: text,
			}
		}
	}, [])

	const responseData = tryParseJson(responseText || "")
	const formattedResponseText = responseData.formatted
	const responseIsJson = responseData.isJson

	// Get current status values
	const currentStatus = status?.status
	const currentError = status?.error

	return (
		<div className={cn("w-full pl-6 pr-1 pt-1", className)}>
			{/* Header with tool info and status */}
            <div className="w-full bg-vscode-editor-background border border-vscode-border rounded-md p-2">
                <div className="flex flex-row items-center justify-between gap-2 mb-1">
                    <div className="flex flex-row items-center gap-1 flex-wrap">
                        <Wrench size={16} className="text-vscode-descriptionForeground" />
                        <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-bold text-vscode-foreground mt-2 mb-2 ml-1">
                                {toolDisplayName || toolName}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-row items-center justify-between gap-2 px-1">
                        <div className="flex flex-row items-center gap-1">
                            {currentStatus && (
                                <div className="flex flex-row items-center gap-2 font-mono text-xs">
                                    <div
                                        className={cn("rounded-full size-1.5", {
                                            "bg-yellow-400": currentStatus === "started" || currentStatus === "output",
                                            "bg-lime-400": currentStatus === "completed",
                                            "bg-red-400": currentStatus === "error",
                                        })}
                                    />
                                    <div
                                        className={cn("whitespace-nowrap", {
                                            "text-vscode-foreground": currentStatus === "started" || currentStatus === "completed",
                                            "text-vscode-errorForeground": currentStatus === "error",
                                        })}>
                                        {currentStatus === "completed"
                                            ? "已完成"
                                            : currentStatus === "error"
                                                ? "错误"
                                                : "执行中..."}
                                    </div>
                                    {currentStatus === "error" && currentError && (
                                        <div className="whitespace-nowrap text-vscode-errorForeground">({currentError})</div>
                                    )}
                                </div>
                            )}
                            {responseText && responseText.length > 0 && (
                                <Button variant="ghost" size="icon" onClick={onToggleResponseExpand}>
                                    <ChevronDown
                                        className={cn("size-4 transition-transform duration-300", {
                                            "rotate-180": isResponseExpanded,
                                        })}
                                    />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

			    {/* Content area */}
			
				{/* Parameters section - display as key-value pairs */}
				{parameters.length > 0 && (
					<div className="space-y-1 mt-2">
						{parameters.map((param, index) => (
							<div key={index} className="flex flex-col gap-1">
								<div className="text-xs text-vscode-descriptionForeground font-medium">
									{param.label || param.name}:
								</div>
								<div className="text-sm text-vscode-foreground bg-vscode-input-background border border-vscode-input-border rounded px-2 py-1">
									{param.value}
								</div>
							</div>
						))}
					</div>
				)}

				{/* Response section - collapsible */}
				{responseText && (
					<ResponseContainer
						isExpanded={isResponseExpanded}
						response={formattedResponseText}
						isJson={responseIsJson}
						hasParameters={parameters.length > 0}
						isPartial={currentStatus ? currentStatus !== "completed" : isPartial}
					/>
				)}
			</div>
		</div>
	)
}

ToolExecution.displayName = "ToolExecution"

const ResponseContainerInternal = ({
	isExpanded,
	response,
	isJson,
	hasParameters,
	isPartial = false,
}: {
	isExpanded: boolean
	response: string
	isJson: boolean
	hasParameters?: boolean
	isPartial?: boolean
}) => {
	// Only render content when expanded to prevent performance issues with large responses
	if (!isExpanded || response.length === 0) {
		return (
			<div
				className={cn("overflow-hidden", {
					"max-h-0": !isExpanded,
				})}
			/>
		)
	}

	return (
		<div
			className={cn("overflow-hidden", {
				"max-h-96 overflow-y-auto mt-1 pt-1 border-t border-border/25": hasParameters,
				"max-h-96 overflow-y-auto mt-1 pt-1": !hasParameters,
			})}>
			{isJson ? (
				<CodeBlock source={response} language="json" />
			) : (
				<Markdown markdown={response} partial={isPartial} />
			)}
		</div>
	)
}

const ResponseContainer = memo(ResponseContainerInternal)

export default ToolExecution
