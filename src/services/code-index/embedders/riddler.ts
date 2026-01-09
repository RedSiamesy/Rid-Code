import { IEmbedder, EmbeddingResponse, EmbedderInfo, AvailableEmbedders } from "../interfaces/embedder"

/**
 * Riddler implementation of the embedder interface.
 */
export class RiddlerEmbedder implements IEmbedder {
	async createEmbeddings(texts: string[], _model?: string): Promise<EmbeddingResponse> {
		return {
			embeddings: texts.map(() => []),
			usage: {
				promptTokens: 0,
				totalTokens: 0,
			},
		}
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return { valid: true }
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "riddler" as AvailableEmbedders,
		}
	}
}
