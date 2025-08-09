import type { McpClient } from "@/helpers/mcpConnectionManager";
import {
  getPooledConnection,
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
    // Get pooled connection (don't disconnect after use!)
    const connection = await getPooledConnection(mcpName);
    if (!connection || !connection.client) {
      return {
        mcpName,
        tools: [],
        success: false,
        error: "Failed to connect to MCP server",
      };
    }

    const { client } = connection;

    // Fetch tools using the pooled connection
    const toolsResult = await getTools(client);

    // DO NOT disconnect - let the pool manage the connection lifecycle
    return {
      mcpName,
      tools: toolsResult.tools || [],
      success: true,
    };
  } catch (error: any) {
    return {
      mcpName,
      tools: [],
      success: false,
      error: error.message || String(error),
    };
  }
};

// Small concurrency limiter to avoid blasting many MCPs at the same time
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as any;
  let idx = 0;
  let active = 0;
  return new Promise((resolve, reject) => {
    const next = () => {
      if (idx >= items.length && active === 0) return resolve(results);
      while (active < limit && idx < items.length) {
        const current = idx++;
        active++;
        const item = items[current]!; // current is within bounds
        mapper(item)
          .then((res) => {
            results[current] = res as any;
          })
          .catch((err) => {
            results[current] = err as any;
          })
          .finally(() => {
            active--;
            next();
          });
      }
    };
    next();
  });
}

export const getToolsFromAllMcps = async (
  spinner?: any,
  maxConcurrency: number = 6
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

    // Fetch in parallel with capped concurrency
    const results = await mapWithConcurrency(
      onlineMcps,
      Math.max(1, maxConcurrency),
      (mcp) => getToolsFromMcp(mcp, spinner)
    );

    return results as McpToolsResult[];
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
