import { getPooledConnection } from "@/helpers/mcpConnectionManager";
import { getTools } from "@/tools/list/actions/getTools";
import { extractMcpName } from "../../utils";

export const singleToolsResponse = async (pathname: string) => {
  // Extract mcpName from pathname
  const mcpNameResult = extractMcpName(pathname, "tools");
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }
  const mcpName = mcpNameResult;

  try {
    // Use pooled connection
    const connection = await getPooledConnection(mcpName);

    if (!connection || !connection.client) {
      return new Response(
        JSON.stringify({ success: false, message: "MCP not found" }),
        { status: 503 }
      );
    }

    const toolsResult = await getTools(connection.client);
    return new Response(
      JSON.stringify({
        success: true,
        data: toolsResult.tools,
      })
    );
  } catch (error: any) {
    console.error(`[${mcpName}] Error fetching tools:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Error fetching tools from MCP server",
      }),
      { status: 500 }
    );
  }
};
