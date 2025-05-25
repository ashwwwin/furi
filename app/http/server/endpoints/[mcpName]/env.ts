import { getEnv, scanEnvVars } from "@/mcp/env/actions/scanEnvVars";
import { extractMcpName } from "../../utils";

export async function envResponse(pathname: string): Promise<Response> {
  // Extract mcpName from pathname
  const mcpNameResult = extractMcpName(pathname, "env");

  // Handle potential Response error from mcpName extraction
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  const mcpName = mcpNameResult;
  const env = await scanEnvVars(mcpName);
  return new Response(JSON.stringify({ success: true, data: env }));
}
