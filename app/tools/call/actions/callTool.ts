import { getPooledConnection } from "@/helpers/mcpConnectionManager";

export const executeToolCall = async (
  mcpName: string,
  toolName: string,
  data: string
): Promise<any | { error: any }> => {
  try {
    // Get a pooled connection to the MCP server
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

    // List available tools to validate the requested tool
    const tools = await client.listTools();
    const requestedTool = tools.tools.find(
      (tool: any) => tool.name === toolName
    );

    if (!requestedTool) {
      throw new Error(
        `Tool '${toolName}' not found. Available tools: ${tools.tools
          .map((t: any) => t.name)
          .join(", ")}`
      );
    }

    // Call the tool using the pooled connection
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
