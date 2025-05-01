import type { McpClient } from "@/helpers/mcpConnectionManager";
import {
  setupMcpConnection,
  disconnectFromPm2,
} from "@/helpers/mcpConnectionManager";
import { getProcStatus } from "@/mcp/status/actions/getProcStatus";

export interface Tool {
  name: string;
  description?: string;
  inputSchema?: {
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolsResult {
  tools: Tool[];
}

export interface McpToolsResult {
  mcpName: string;
  tools: Tool[];
  success: boolean;
  error?: string;
}

export const getTools = async (client: McpClient): Promise<ToolsResult> => {
  const tools = await client.listTools();
  return tools;
};

// Get tools from a single MCP by name
export const getToolsFromMcp = async (
  mcpName: string,
  spinner?: any
): Promise<McpToolsResult> => {
  try {
    // Setup MCP connection
    const resources = await setupMcpConnection(mcpName, spinner);
    if (!resources || !resources.client) {
      return {
        mcpName,
        tools: [],
        success: false,
        error: "Failed to connect to MCP server",
      };
    }

    const { client, disconnect } = resources;

    try {
      // Fetch tools
      const toolsResult = await getTools(client);

      // Cleanup resources
      await disconnect();

      return {
        mcpName,
        tools: toolsResult.tools || [],
        success: true,
      };
    } catch (error: any) {
      // Ensure cleanup on error
      await disconnect();
      throw error;
    }
  } catch (error: any) {
    return {
      mcpName,
      tools: [],
      success: false,
      error: error.message || String(error),
    };
  }
};

export const getToolsFromAllMcps = async (
  spinner?: any
): Promise<McpToolsResult[]> => {
  try {
    // Get list of all MCPs
    const result = await getProcStatus("all");

    // Make sure to disconnect from PM2 after getting process status
    await disconnectFromPm2();

    if (!result.success || !result.data || !Array.isArray(result.data)) {
      throw new Error(`Failed to get MCP list: ${result.message}`);
    }

    // Filter to only include online MCPs
    const onlineMcps = result.data
      .filter((mcp) => mcp.status === "online" && mcp.pid !== "N/A")
      .map((mcp) => mcp.name);

    if (onlineMcps.length === 0) {
      throw new Error(`No online MCPs found`);
    }

    const allResults: McpToolsResult[] = [];

    // Process each MCP using the single MCP function
    for (const mcp of onlineMcps) {
      const result = await getToolsFromMcp(mcp, spinner);
      allResults.push(result);
    }

    return allResults;
  } catch (error: any) {
    // Make sure to disconnect from PM2 in case of error
    try {
      await disconnectFromPm2();
    } catch {}

    throw new Error(
      `Error fetching tools from all MCPs: ${error.message || String(error)}`
    );
  }
};
