import { getToolsFromAllMcps } from "@/tools/list/actions/getTools";

export const toolsResponse = async () => {
  try {
    const mcpResults = await getToolsFromAllMcps();

    let tools: any = [];

    for (const mcpResult of mcpResults) {
      if (mcpResult.success && mcpResult.tools) {
        mcpResult.tools.forEach((tool: any) => {
          tools.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            mcpName: mcpResult.mcpName,
          });
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: tools,
      })
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Failed to get tools",
      })
    );
  }
};
