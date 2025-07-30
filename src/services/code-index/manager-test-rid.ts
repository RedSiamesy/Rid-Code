/**
 * 使用 OpenAI 官方 API 协议，发送“你好”测试大模型服务可用性。
 * @param apiKey OpenAI API Key
 * @param model OpenAI 模型名称（如 'gpt-3.5-turbo'）
 * @param baseUrl OpenAI API Base URL，默认为 https://api.openai.com/v1
 * @returns Promise<boolean>，可用返回 true，否则 false
 */
export async function testOpenAIApiAvailable({ apiKey, model, baseUrl }: { apiKey: string; model: string; baseUrl: string }): Promise<boolean> {
    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "user", content: "hello" }
                ],
                max_tokens: 16
            })
        });
        
        // 无论响应状态如何，都先尝试读取 body，避免 body 被重复读取
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("[CodeIndexManager] Failed to parse OpenAI response JSON:", parseError);
            return false;
        }
        
        // 检查响应状态和数据结构
        if (!response.ok) {
            console.error("[CodeIndexManager] OpenAI API returned error:", response.status, data);
            return false;
        }
        
        // 判断返回内容是否包含 expected 字段
        return !!(data && data.choices && data.choices.length > 0 && data.choices[0].message ); // && data.choices[0].message.content
    } catch (error) {
        console.error("[CodeIndexManager] OpenAI API test failed:", error);
        return false;
    }
}

/**
 * 使用 SiliconFlow Rerank API 协议，发送测试请求判断 rerank 服务可用性（新版协议，返回 results/relevance_score）。
 * @param apiKey Rerank API Key
 * @param model Rerank 模型名称（如 'BAAI/bge-reranker-v2-m3'）
 * @param baseUrl Rerank API Base URL，默认为 https://api.siliconflow.cn/v1/rerank
 * @returns Promise<boolean>，可用返回 true，否则 false
 */
export async function testRerankApiAvailable({ apiKey, model, baseUrl = "https://api.siliconflow.cn/v1" }: { apiKey: string; model: string; baseUrl?: string }): Promise<boolean> {
    try {
        const response = await fetch(`${baseUrl}/rerank`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                query: "Apple",
                documents: ["apple", "banana", "fruit", "vegetable"],
                top_n: 4,
                return_documents: false,
                max_chunks_per_doc: 1024,
                overlap_tokens: 80
            })
        });
        
        // 无论响应状态如何，都先尝试读取 body，避免 body 被重复读取
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("[CodeIndexManager] Failed to parse response JSON:", parseError);
            return false;
        }
        
        // 检查响应状态和数据结构
        if (!response.ok) {
            console.error("[CodeIndexManager] Rerank API returned error:", response.status, data);
            return false;
        }
        
        // 判断返回内容是否包含 results 且有 relevance_score 字段
        return !!(data && Array.isArray(data.results) && data.results.length > 0 && typeof data.results[0].relevance_score === "number");
    } catch (error) {
		console.error("[CodeIndexManager] Rerank API test failed:", error);
        return false;
    }
}

/**
 * 使用 OpenAI Embedding API 协议，发送测试请求判断 embedding 服务可用性。
 * @param apiKey OpenAI API Key
 * @param model Embedding 模型名称（如 'text-embedding-ada-002'）
 * @param baseUrl OpenAI API Base URL，默认为 https://api.openai.com/v1
 * @returns Promise<boolean>，可用返回 true，否则 false
 */
export async function testEmbeddingApiAvailable({ apiKey, model, baseUrl = "https://api.openai.com/v1" }: { apiKey: string; model: string; baseUrl?: string }): Promise<boolean> {
    try {
        const response = await fetch(`${baseUrl}/embeddings`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                input: "test embedding",
                encoding_format: "float"
            })
        });
        
        // 无论响应状态如何，都先尝试读取 body，避免 body 被重复读取
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("[CodeIndexManager] Failed to parse embedding response JSON:", parseError);
            return false;
        }
        
        // 检查响应状态和数据结构
        if (!response.ok) {
            console.error("[CodeIndexManager] Embedding API returned error:", response.status, data);
            return false;
        }
        
        // 判断返回内容是否包含 data 且有 embedding 字段
        return !!(data && Array.isArray(data.data) && data.data.length > 0 && Array.isArray(data.data[0].embedding) && data.data[0].embedding.length > 0);
    } catch (error) {
        console.error("[CodeIndexManager] Embedding API test failed:", error);
        return false;
    }
}
