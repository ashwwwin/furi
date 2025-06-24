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

  let result = await getProcStatus(mcpName);
  if (!result.success) {
    return new Response(
      JSON.stringify({ success: false, error: result.message })
    );
  }

  // Destructure to exclude the success property
  const { success, ...resultData } = result;

  const logs = await getMCPLogs(mcpName, lines);

  if (!logs.success) {
    return new Response(JSON.stringify({ success: false, error: logs.error }));
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: { ...resultData.data, logs },
    })
  );
};
