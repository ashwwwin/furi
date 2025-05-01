import { setupMcpConnection } from "@/helpers/mcpConnectionManager";
import { getTools } from "@/tools/list/actions/getTools";
import { extractMcpName } from "../../utils";

export const specificToolsResponse = async (pathname: string) => {
  // Extract mcpName from pathname
  const mcpNameResult = extractMcpName(pathname, "tools");
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }
  const mcpName = mcpNameResult;

  const resources = await setupMcpConnection(mcpName);

  if (!resources || !resources.client) {
    return new Response(
      JSON.stringify({ success: false, message: "MCP not found" })
    );
  }

  const tools = await getTools(resources.client);
  return new Response(JSON.stringify(tools));
};
