import Anthropic from "@anthropic-ai/sdk"
import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { parseXml } from "../../utils/xml"

export async function askFollowupQuestionTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const question: string | undefined = block.params.question
	const follow_up: string | undefined = block.params.follow_up

	try {
		if (block.partial) {
			await cline.ask("followup", removeClosingTag("question", question), block.partial).catch(() => {})
			return
		} else {
			if (!question) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("ask_followup_question")
				pushToolResult(await cline.sayAndCreateMissingParamError("ask_followup_question", "question"))
				return
			}

			type Suggest = { answer: string }

			let follow_up_json = {
				question,
				suggest: [] as Suggest[],
			}

			if (follow_up) {
				let parsedSuggest: {
					suggest: Suggest[] | Suggest
				}

				try {
					parsedSuggest = parseXml(follow_up, ["suggest"]) as { suggest: Suggest[] | Suggest }
				} catch (error) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("ask_followup_question")
					await cline.say("error", `Failed to parse operations: ${error.message}`)
					pushToolResult(formatResponse.toolError("Invalid operations xml format"))
					return
				}

				const normalizedSuggest = Array.isArray(parsedSuggest?.suggest)
					? parsedSuggest.suggest
					: [parsedSuggest?.suggest].filter((sug): sug is Suggest => sug !== undefined)

				follow_up_json.suggest = normalizedSuggest
			}

			cline.consecutiveMistakeCount = 0
			const { text, images } = await cline.ask("followup", JSON.stringify(follow_up_json), false)
			if (follow_up?.includes(`<suggest>${text}</suggest>`)) {
				await cline.say("user_feedback", text ?? "", images)
				pushToolResult(formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images))
			} else {
				await cline.say("text", text ?? "", images)
				const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
				toolResults.push({
					type: "text",
					text: `The user has proposed a solution:\n<feedback>\n${text}\n</feedback>`,
				})
				toolResults.push(...formatResponse.imageBlocks(images))
				cline.userMessageContent.push(...toolResults)
			}
			return
		}
	} catch (error) {
		await handleError("asking question", error)
		return
	}
}
