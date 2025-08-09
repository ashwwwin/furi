import { getToolsFromAllMcps } from "@/tools/list/actions/getTools";

let toolsCache: { timestamp: number; data: any[] } | null = null;
const TOOLS_CACHE_TTL_MS = 750; // keep it very fresh, but avoid duplicate PM2 scans under burst

export const toolsResponse = async () => {
  try {
    const now = Date.now();
    if (toolsCache && now - toolsCache.timestamp < TOOLS_CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({ success: true, data: toolsCache.data })
      );
    }

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

    toolsCache = { timestamp: now, data: tools };

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
