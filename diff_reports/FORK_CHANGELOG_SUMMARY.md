# Roo-Code fork 变更总结（相对 3.39.3）

## 对比范围
- 原版：`C:\Users\wxyri\Documents\Roo-Code-3.39.3`
- Fork：`C:\Users\wxyri\Documents\Roo-Code-main`
- 对比时间：2026-02-23

## 变更规模（全量）
- 新增文件：`983`
- 修改文件：`250`
- 删除文件：`10`

说明：新增里有大量资源文件，`src/assets/vscode-material-icons/` 单独新增约 `911` 个图标文件，属于素材扩充，不是核心业务逻辑。

## 前端改动（webview-ui）
- 新增：`10`
- 修改：`85`
- 删除：`0`

前端新增重点：
- 新增技能设置页：`webview-ui/src/components/settings/SkillsSettings.tsx`
- 新增记忆展示组件：`webview-ui/src/components/chat/SaveMemoryRow.tsx`
- 新增 8 个 Provider 设置面板（AiCoder/Aliyun/IFlow/Infini/ModelScope/Qianfan/ZCode/Zen）

## 主要新增/增强功能

### 1) 新增多家模型 Provider 接入
实现了从类型定义、后端 handler、到前端设置页的完整接入链路。

主要新增：
- 类型定义：`packages/types/src/providers/{aicoder,aliyun,iflow,infini,modelscope,qianfan,zcode,zen}.ts`
- 后端 Provider：`src/api/providers/{aicoder,aliyun,iflow,infini,modelscope,qianfan,zcode,zen}.ts`
- 前端配置页：`webview-ui/src/components/settings/providers/{AiCoder,Aliyun,IFlow,Infini,ModelScope,Qianfan,ZCode,Zen}.tsx`
- Provider 导出聚合：`src/api/providers/index.ts`

可见功能效果：可在设置中选择并配置更多模型供应商。

### 2) 新增 Agent 工具能力：`grep` / `glob` / `web_search` / `url_fetch`
新增了 4 类工具，并接入到 prompt、tool schema、消息展示和审批链路。

关键实现文件：
- 工具实现：
  - `src/core/tools/GrepTool.ts`
  - `src/core/tools/GlobTool.ts`
  - `src/core/tools/WebSearchTool.ts`
  - `src/core/tools/UrlFetchTool.ts`
- 工具描述（prompt）：
  - `src/core/prompts/tools/{grep,glob,web-search,url-fetch}.ts`
  - `src/core/prompts/tools/native-tools/{grep,glob,web_search,url_fetch}.ts`
- 类型与消息协议：
  - `src/shared/tools.ts`
  - `packages/types/src/tool.ts`
  - `packages/types/src/message.ts`

补充：`web_search` / `url_fetch` 实现里走了代理接口 `https://riddler.mynatapp.cc/llm_tool`。

### 3) 记忆（Memory）能力增强
新增“保存记忆”流程，支持全局与项目级记忆文件管理。

关键实现：
- 后端：`src/core/webview/memory.ts`
  - 读写 `global-memory.md` 与 `.roo/project-memory.md`
  - 解析 AI 返回的增删操作（`+/-/++/--`）并落盘
- 前端：
  - 输入触发：`webview-ui/src/components/chat/ChatTextArea.tsx`（发送 `saveMemory`）
  - 展示组件：`webview-ui/src/components/chat/SaveMemoryRow.tsx`
  - 消息处理：`webview-ui/src/components/chat/ChatView.tsx`（处理 `savedMemory`）

可见功能效果：用户可将对话中的长期信息沉淀为全局/项目记忆。

### 4) Skills（技能）系统增强
新增了技能管理的前后端交互，支持请求技能列表、创建技能模板，并把技能注入系统提示。

关键实现：
- 前端：`webview-ui/src/components/settings/SkillsSettings.tsx`
- 消息处理：`src/core/webview/webviewMessageHandler.ts`
  - `requestSkills`
  - `createSkill`（创建 `SKILL.md` 模板）
- 类型定义：`packages/types/src/skills.ts`
- 系统提示注入：`src/core/prompts/sections/skills.ts`
- 任务/提及链路接入：`src/core/task/Task.ts`、`src/core/mentions/index.ts`

可见功能效果：可在 UI 中查看与新建技能，并在对话中让模型按技能流程执行。

### 5) Code Index 相关扩展（Riddler）
新增了 Riddler 相关的嵌入/解析/向量存储接口实现文件：
- `src/services/code-index/embedders/riddler.ts`
- `src/services/code-index/processors/parser-riddler.ts`
- `src/services/code-index/vector-store/riddler-client.ts`

说明：从实现看目前偏“占位/接线”形态（如 embedder 返回空向量），更像为后续完整接入预留扩展点。

### 6) 工程化与流程改动
- 新增发布说明相关 action/script：`.github/actions/ai-release-notes/action.yml` 等
- 新增 `discord-pr-notify` workflow
- Husky 结构调整（新增 `.husky/_/*`，删除旧顶层 pre-commit/pre-push）

## 结论（业务角度）
这个 fork 的主要方向是：
1. 扩大模型 Provider 生态接入。
2. 增强 Agent 工具能力（检索、抓取、文件匹配）。
3. 引入并强化“技能系统 + 记忆系统”。
4. 补充 code-index 的 Riddler 扩展点。
5. 同步做了较大规模前端与工程流程改造。

## 已生成的差异文件
- `diff_reports/roocode-main_vs_3.39.3_name-status.txt`
- `diff_reports/roocode-main_vs_3.39.3_summary.json`
- `diff_reports/roocode-main_vs_3.39.3_text.patch`
