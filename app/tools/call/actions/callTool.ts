import type { McpClient } from "@/helpers/mcpConnectionManager";

export const executeToolCall = async (
  client: McpClient,
  toolName: string,
  data: string
): Promise<any | { error: any }> => {
  // Using 'any' for the result type temporarily
  try {
    // List available tools to validate the requested tool
    const tools = await client.listTools();
    const requestedTool = tools.tools.find(
      (tool: any) => tool.name === toolName
    );

    if (!requestedTool) {
      throw new Error(
        `Tool '${toolName}' not found. To view tools, use furi tools <mcpName>`
      );
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
        `Invalid JSON input format. Input must be a valid JSON string: '{"param1":"value1","param2":"value2"}'`
      );
    }

    // Call the tool
    const result = await client.callTool({
      name: toolName,
      arguments: toolParams,
    });

    return result;
  } catch (error) {
    // Catch errors from listTools, parsing, or callTool and return them
    return { error: error };
  }
};
