import { ToolArgs, OpenAIToolDefinition } from "./types"

export function getUseMcpToolDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub) {
		return undefined
	}
	return `## use_mcp_tool
Description: Request to use a tool provided by a connected MCP server. Each MCP server can provide multiple tools with different capabilities. Tools have defined input schemas that specify required and optional parameters.
Parameters:
- server_name: (required) The name of the MCP server providing the tool
- tool_name: (required) The name of the tool to execute
- arguments: (required) A JSON object containing the tool's input parameters, following the tool's input schema
Usage:
<use_mcp_tool>
<server_name>server name here</server_name>
<tool_name>tool name here</tool_name>
<arguments>
{
  "param1": "value1",
  "param2": "value2"
}
</arguments>
</use_mcp_tool>

Example: Requesting to use an MCP tool

<use_mcp_tool>
<server_name>weather-server</server_name>
<tool_name>get_forecast</tool_name>
<arguments>
{
  "city": "San Francisco",
  "days": 5
}
</arguments>
</use_mcp_tool>`
}


// /**
//  * Get available MCP tools information for OpenAI tool definition
//  */
// function getMcpToolsInfo(args: ToolArgs): string {
// 	if (!args.mcpHub) {
// 		return "No MCP servers connected."
// 	}

// 	const connectedServers = args.mcpHub.getServers().filter((server) => server.status === "connected")

// 	// Filter servers based on mode
// 	const filteredServers = connectedServers.filter((server) => {
// 		if (!args.settings?.mode) return true
// 		const cfg = server.config ? JSON.parse(server.config) : {}
// 		const enabledModes = cfg.enabledModes || []
// 		const disabledModes = cfg.disabledModes || []
		
// 		if (enabledModes.length > 0) {
// 			return enabledModes.includes(args.settings.mode) && !disabledModes.includes(args.settings.mode)
// 		}
// 		return !disabledModes.includes(args.settings.mode)
// 	})

// 	// Collect all available tools
// 	const toolsInfo: string[] = []

// 	for (const server of filteredServers) {
// 		if (server.tools) {
// 			for (const tool of server.tools) {
// 				// Skip tools that are not enabled for prompt
// 				if (tool.enabledForPrompt === false) {
// 					continue
// 				}

// 				const schemaStr = tool.inputSchema
// 					? `\nInput Schema:\n${JSON.stringify(tool.inputSchema, null, 2)}`
// 					: ""

// 				toolsInfo.push(`- ${tool.name} (from ${server.name}): ${tool.description}${schemaStr}`)
// 			}
// 		}
// 	}

// 	if (toolsInfo.length === 0) {
// 		return "No MCP tools available."
// 	}

// 	return `Available MCP Tools:\n\n${toolsInfo.join("\n\n")}`
// }

// export function getUseMcpToolOpenAIToolDefinition(args: ToolArgs): OpenAIToolDefinition | undefined {
// 	if (!args.mcpHub) {
// 		return undefined
// 	}

// 	// Get available tools information
// 	const toolsInfo = getMcpToolsInfo(args)

// 	return {
// 		type: "function",
// 		function: {
// 			name: "use_mcp_tool",
// 			description: `Request to use a tool provided by a connected MCP server. Each MCP server can provide multiple tools with different capabilities. Tools have defined input schemas that specify required and optional parameters.\n\n${toolsInfo}`,
// 			parameters: {
// 				type: "object",
// 				properties: {
// 					server_name: {
// 						type: "string",
// 						description: "The name of the MCP server providing the tool"
// 					},
// 					tool_name: {
// 						type: "string",
// 						description: "The name of the tool to execute"
// 					},
// 					arguments: {
// 						type: "string",
// 						description: "A JSON object containing the tool's input parameters, following the tool's input schema"
// 					}
// 				},
// 				required: ["server_name", "tool_name", "arguments"]
// 			}
// 		}
// 	}
// }