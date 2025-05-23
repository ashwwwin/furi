import { setupMcpConnection } from "@/helpers/mcpConnectionManager";
import { getTools } from "@/tools/list/actions/getTools";
import { listResponse } from "./list";

export const toolsResponse = async () => {
  const list = await listResponse();

  const listData = await list.json();

  if (!Array.isArray(listData)) {
    return new Response(
      JSON.stringify({ success: false, message: "Failed to get MCPs" })
    );
  }

  let tools: any = [];
  for (const mcp of listData) {
    const resources = await setupMcpConnection(mcp);

    if (!resources || !resources.client) {
      continue;
    }

    const { client } = resources;

    // Fetch tools using the action
    const toolsResult = await getTools(client);

    toolsResult.tools.map((tool: any) => {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        mcpName: mcp,
      });
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: tools,
    })
  );
};
