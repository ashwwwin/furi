import { getProcStatus } from "@/mcp/status/actions/getProcStatus";
import { getMCPLogs } from "@/mcp/status/index";
import { extractMcpName } from "../../utils";

export const singleStatusResponse = async (pathname: string, url: URL) => {
  // Use extractMcpName to get the mcpName or an error Response
  const mcpNameResult = extractMcpName(pathname, "status");

  // Handle potential Response error from mcpName extraction
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  // If we got here, mcpNameResult is a string
  const mcpName = mcpNameResult;

  // Parse ?lines= param if present
  const linesParam = url.searchParams.get("lines");
  const lines = linesParam ? parseInt(linesParam, 10) : 5;

  const result = await getProcStatus(mcpName);
  const logs = await getMCPLogs(mcpName, lines);
  return new Response(
    JSON.stringify({ ...result, logs })
  );
};
