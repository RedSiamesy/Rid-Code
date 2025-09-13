# 代码库服务使用指南

这个示例展示了如何启动和使用代码库服务。

## 启动服务

服务启动时需要通过命令行参数配置代码库实例：

```bash
# 基本启动命令（必需参数）
python -m codebase_service --embedding-url https://api.siliconflow.cn/v1 --embedding-key sk-eltlseyllqvftoeiavoxnitdmgqzeylnponzeslxgjcuiwuf --embedding-model BAAI/bge-m3 --enhancement --enhancement-model z-ai/glm-4.5-air:free --enhancement-url https://openrouter.ai/api/v1 --enhancement-key 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 --rag-path .

python -m codebase_service --embedding-url https://api.siliconflow.cn/v1 --embedding-key sk-eltlseyllqvftoeiavoxnitdmgqzeylnponzeslxgjcuiwuf --embedding-model BAAI/bge-m3 --rag-path .

# 完整配置启动
python -m codebase_service \
  --host 0.0.0.0 \
  --port 8000 \
  --rag-name "my_codebase" \
  --rag-path "./data" \
  --embedding-url "http://your-embedding-service/embeddings" \
  --embedding-model "text-embedding-ada-002" \
  --embedding-key "your-api-key" \
  --enhancement \
  --enhancement-url "http://your-llm-service/chat/completions" \
  --enhancement-model "gpt-3.5-turbo" \
  --enhancement-key "your-api-key" \
  --rerank-url "http://your-rerank-service/rerank" \
  --rerank-model "rerank-model" \
  --rerank-key "your-api-key" \
  --reload

# 使用 uvicorn 启动（需要先设置环境变量或修改代码）
# uvicorn codebase_service.__main__:app --host 0.0.0.0 --port 8000 --reload
```

### 命令行参数说明

- `--host`: 服务监听地址（默认: 0.0.0.0）
- `--port`: 服务监听端口（默认: 8000）
- `--reload`: 开启热重载
- `--rag-name`: RAG名称（默认: code_rag）
- `--rag-path`: RAG存储路径
- `--embedding-url`: 嵌入模型API地址（必需）
- `--embedding-model`: 嵌入模型名称
- `--embedding-key`: 嵌入模型API密钥
- `--enhancement`: 启用增强功能
- `--enhancement-url`: 增强模型API地址
- `--enhancement-model`: 增强模型名称
- `--enhancement-key`: 增强模型API密钥
- `--rerank-url`: 重排序模型API地址
- `--rerank-model`: 重排序模型名称
- `--rerank-key`: 重排序模型API密钥

## API 使用示例

### 1. 添加文件

```bash
curl -X POST "http://localhost:8000/add_file" \
  -H "Content-Type: application/json" \
  -d '{
    "collection_name": "my_collection",
    "file_path": "/path/to/file.py",
    "content": "def hello():\n    print(\"Hello, World!\")"
  }'
```

**响应示例：**
```json
{
  "status": "success",
  "message": "文件 /path/to/file.py 添加成功",
  "file_path": "/path/to/file.py",
  "collection_name": "my_collection"
}
```

### 2. 搜索代码

```bash
curl -X POST "http://localhost:8000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "collection_name": "my_collection",
    "queries": ["function", "hello"],
    "n_results": 10,
    "padding": 3,
    "threshold": 0.5,
    "rerank_enable": true,
    "paths": []
  }'
```

**响应示例：**

```json
{
  "status": "success",
  "data": [
    {
      "file_path": "test.py",
      "code": "",
      "lines": [1, 2, 3, 4],
      "score": 1.4997336864471436
    }
  ]
}
```

**响应字段说明：**

- `file_path`: 匹配的文件路径
- `code`: 代码片段内容（当前实现为空，行号在lines字段中）
- `lines`: 匹配的代码行号数组
- `score`: 相似度分数

### 3. 获取文件列表

```bash
curl "http://localhost:8000/files/my_collection"
```

**响应示例：**

```json
{
  "status": "success",
  "files": [
    "/path/to/file1.py",
    "/path/to/file2.js",
    "/path/to/file3.java"
  ]
}
```

**错误响应（集合不存在）：**

```json
{
  "status": "error",
  "message": "not exist"
}
```

### 4. 获取摘要

```bash
curl -X POST "http://localhost:8000/summary" \
  -H "Content-Type: application/json" \
  -d '{
    "collection_name": "my_collection",
    "paths": null
  }'
```

**响应示例：**

```json
{
  "status": "success",
  "data": [
    {
      "file_path": "/path/to/file.py",
      "code": ["函数hello用于打印问候信息", "函数goodbye用于打印告别信息"],
      "lines": [0]
    }
  ]
}
```

**响应字段说明：**

- `file_path`: 文件路径
- `code`: 增强摘要信息数组
- `lines`: 行号（摘要通常为[0]）

### 5. 删除指定文件

删除collection中的多个特定文件记录：

```bash
curl -X POST "http://localhost:8000/delete_files" \
  -H "Content-Type: application/json" \
  -d '{
    "collection_name": "my_collection",
    "file_paths": ["/path/to/file1.py", "/path/to/file2.py", "/path/to/file3.js"]
  }'
```

响应示例：
```json
{
  "status": "success",
  "message": "成功从集合 my_collection 中删除 3 个文件的记录",
  "deleted_files": ["/path/to/file1.py", "/path/to/file2.py", "/path/to/file3.js"],
  "deleted_count": 3,
  "version": 5
}
```

**注意事项：**

- `file_paths` 必须是一个字符串数组
- 如果某些文件不存在，不会报错，会静默跳过
- 空的 `file_paths` 数组不会执行任何操作
- 返回的 `version` 是LanceDB表的新版本号

### 6. 删除整个索引

```bash
curl -X POST "http://localhost:8000/delete/my_collection"
```

**响应示例：**

```json
{
  "status": "success",
  "message": "集合 my_collection 的索引删除成功"
}
```

**错误响应（集合不存在）：**

```json
{
  "detail": "集合 my_collection 不存在"
}
```

### 7. 健康检查

```bash
curl "http://localhost:8000/health"
```

**响应示例：**

```json
{
  "status": "healthy",
  "message": "代码库服务运行正常"
}
```

### 8. 根路径信息

```bash
curl "http://localhost:8000/"
```

**响应示例：**

```json
{
  "service": "代码库服务API",
  "version": "1.0.0",
  "description": "提供代码库搜索、索引和管理功能",
  "docs": "/docs"
}
```

## 访问 API 文档

启动服务后，可以访问以下地址查看交互式 API 文档：

- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

## 错误处理

### 常见错误响应格式

**400 Bad Request - 请求参数错误：**

```json
{
  "detail": "参数错误信息"
}
```

**404 Not Found - 资源不存在：**

```json
{
  "detail": "集合 collection_name 不存在"
}
```

**500 Internal Server Error - 服务器内部错误：**

```json
{
  "detail": "具体错误信息"
}
```

### HTTP状态码说明

- `200 OK`: 请求成功
- `400 Bad Request`: 请求参数错误或格式不正确
- `404 Not Found`: 请求的资源（如集合）不存在
- `422 Unprocessable Entity`: 请求体格式正确但内容验证失败
- `500 Internal Server Error`: 服务器内部错误
