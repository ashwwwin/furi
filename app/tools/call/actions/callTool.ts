import { getPooledConnection } from "@/helpers/mcpConnectionManager";

// Per-MCP tool list micro cache
const toolListCache: Map<string, { timestamp: number; tools: any[] }> =
  new Map();
const TOOL_LIST_TTL_MS = 1000; // very fresh; reduces redundant listTools within bursts

export const executeToolCall = async (
  mcpName: string,
  toolName: string,
  data: string
): Promise<any | { error: any }> => {
  try {
    const connection = await getPooledConnection(mcpName);

    if (!connection) {
      throw new Error(
        `MCP server '${mcpName}' is not available. Start it first with furi start ${mcpName}`
      );
    }

    const { client } = connection;

    // Parse and validate the input as JSON
    let toolParams: any;
    try {
      // Try to parse as JSON
      if (data.trim().startsWith("{")) {
        toolParams = JSON.parse(data);
      } else {
        // For simple string queries, convert to JSON format
        toolParams = { query: data };
      }
    } catch (e) {
      throw new Error(
        `Invalid JSON input format. Input must be a valid JSON string: '{"param1":"value1","param2":"value2"}'`
      );
    }

    // Prefer cached tools to avoid listTools calls under bursts
    const now = Date.now();
    const cached = toolListCache.get(mcpName);
    let toolsArr: any[];
    if (cached && now - cached.timestamp < TOOL_LIST_TTL_MS) {
      toolsArr = cached.tools;
    } else {
      const listed = await client.listTools();
      toolsArr = listed && Array.isArray(listed.tools) ? listed.tools : [];
      toolListCache.set(mcpName, { timestamp: now, tools: toolsArr });
    }

    const requestedTool = toolsArr.find((tool: any) => tool.name === toolName);

    if (!requestedTool) {
      throw new Error(
        `Tool '${toolName}' not found. Available tools: ${toolsArr
          .map((t: any) => t.name)
          .join(", ")}`
      );
    }

    // Call the tool using the pooled connection (maintains persistence and state)
    const result = await client.callTool({
      name: toolName,
      arguments: toolParams,
    });

    return result;
  } catch (error) {
    // Return error in the expected format
    return { error: error };
  }
};
