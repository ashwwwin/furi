import { stopMCPCore } from "@/mcp/stop/actions/stopMCP";
import { extractMcpName } from "../../utils"; // Import the utility function

export const stopResponse = async (pathname: string) => {
  // Use extractMcpName to get the mcpName or an error Response
  const mcpNameResult = extractMcpName(pathname, "stop");

  // Handle potential Response error from mcpName extraction
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  // If we got here, mcpNameResult is a string
  const mcpName = mcpNameResult;

  const result = await stopMCPCore(mcpName);
  return new Response(
    JSON.stringify({
      success: true,
      data: result,
    })
  );
};
