import { IEmbedder, EmbeddingResponse, EmbedderInfo, AvailableEmbedders } from "../interfaces/embedder"

/**
 * Riddler implementation of the embedder interface
 */
export class RiddlerEmbedder implements IEmbedder {
	constructor() {}

	/**
	 * Creates embeddings for the given texts.
	 * @param texts Array of text strings to create embeddings for
	 * @param model Optional model ID to use for embeddings
	 * @returns Promise resolving to an EmbeddingResponse
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		// Empty implementation - to be implemented based on Riddler service requirements
		return {
			embeddings: texts.map(() => []), // Return empty arrays for each text
			usage: {
				promptTokens: 0,
				totalTokens: 0
			}
		}
	}

	/**
	 * Validates the embedder configuration by testing connectivity and credentials.
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		// Empty implementation - to be implemented based on Riddler service requirements
		// return {
		// 	valid: false,
		// 	error: "Riddler embedder not implemented"
		// }
		return {
			valid: true
		}
	}

	/**
	 * Gets embedder information
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "openai-compatible" as AvailableEmbedders
		}
	}
}
