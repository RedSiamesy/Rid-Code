import { mainlandZAiDefaultModelId, mainlandZAiModels } from "./zai.js"

export const zCodeModels = mainlandZAiModels

export type ZCodeModelId = keyof typeof zCodeModels

export const zCodeDefaultModelId: ZCodeModelId = mainlandZAiDefaultModelId
