import type { McpClient } from "../../../helpers/mcpConnectionManager";

export const getTools = async (client: McpClient) => {
  const tools = await client.listTools();
  return tools;
};
