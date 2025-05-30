import { getPooledConnection } from "@/helpers/mcpConnectionManager";
import { isServerRunning } from "@/aggregator/server/manager";
import { getAggregatorPort } from "@/helpers/config";

// Enhanced implementation - Uses aggregator for persistence when available
export const executeToolCall = async (
  mcpName: string,
  toolName: string,
  data: string,
): Promise<any | { error: any }> => {
  try {
    // First, check if aggregator is running for persistent connections
    let useAggregator = false;
    try {
      const aggregatorRunning = await isServerRunning();
      if (aggregatorRunning) {
        useAggregator = true;
        console.log(`     \x1b[2mUsing persistent aggregator connection\x1b[0m`);
      }
    } catch (error) {
      // Aggregator not available, fall back to direct connection
      console.log(`     \x1b[2mAggregator not available, using direct connection\x1b[0m`);
    }

    let client: any;
    let connection: any;

    if (useAggregator) {
      // Use aggregator connection for persistence via SSE
      try {
        const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
        const { SSEClientTransport } = await import("@modelcontextprotocol/sdk/client/sse.js");
        const aggregatorPort = getAggregatorPort();
        
        const transport = new SSEClientTransport(
          new URL(`http://127.0.0.1:${aggregatorPort}/sse`)
        );
        
        client = new Client(
          {
            name: "furikake-cli",
            version: "1.0.0",
          },
          {
            capabilities: {
              tools: {},
            },
          }
        );
        
        await client.connect(transport);
        
        // Transform tool name to match aggregator naming convention
        toolName = `${mcpName}-${toolName}`;
        console.log(`     \x1b[2mConnected to aggregator at port ${aggregatorPort}\x1b[0m`);
      } catch (aggregatorError) {
        console.log(`     \x1b[33mAggregator connection failed: ${aggregatorError}. Falling back to direct connection\x1b[0m`);
        useAggregator = false;
      }
    }

    if (!useAggregator) {
      // Fall back to direct connection (non-persistent)
      connection = await getPooledConnection(mcpName);
      if (!connection) {
        throw new Error(
          `MCP server '${mcpName}' is not available. Start it first with furi start ${mcpName} or use the aggregator with furi meta start`,
        );
      }
      client = connection.client;
      console.log(`     \x1b[33mWarning: Using non-persistent connection. Browser/stateful tools may close after execution.\x1b[0m`);
      console.log(`     \x1b[2mFor persistent connections, start the aggregator: furi meta start\x1b[0m`);
    }

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
        `Invalid JSON input format. Input must be a valid JSON string: '{"param1":"value1","param2":"value2"}'`,
      );
    }

    // List available tools to validate the requested tool
    const tools = await client.listTools();
    const requestedTool = tools.tools.find(
      (tool: any) => tool.name === toolName,
    );

    if (!requestedTool) {
      throw new Error(
        `Tool '${toolName}' not found. Available tools: ${tools.tools
          .map((t: any) => t.name)
          .join(", ")}`,
      );
    }

    // Call the tool using the connection (pooled or aggregator)
    const result = await client.callTool({
      name: toolName,
      arguments: toolParams,
    });

    // Clean up aggregator connection if used
    if (useAggregator && client && typeof client.close === 'function') {
      try {
        await client.close();
      } catch (disconnectError) {
        // Silently ignore disconnect errors
      }
    }

    return result;
  } catch (error) {
    // Return error in the expected format
    return { error: error };
  }
};
