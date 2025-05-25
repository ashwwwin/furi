import { getProcStatus } from "@/mcp/status/actions/getProcStatus";
import { getMCPLogs } from "@/mcp/status/index";
import { extractMcpName } from "../../utils";
import { renamePackage } from "@/mcp/rename/action/renamePackage";

export const renameMCPResponse = async (
  pathname: string,
  url?: URL,
  _newName?: string
) => {
  // Use extractMcpName to get the mcpName or an error Response
  const mcpNameResult = extractMcpName(pathname, "rename");

  // Handle potential Response error from mcpName extraction
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  // If we got here, mcpNameResult is a string
  const mcpName = mcpNameResult;
  let newName = _newName;

  if (!newName) {
    if (url) {
      newName = url.searchParams.get("newName") || "";
    }

    if (!newName) {
      return new Response(
        JSON.stringify({ success: false, message: "Name is required" }),
        { status: 400 }
      );
    }
  }

  const result = await renamePackage(mcpName, newName);

  return new Response(JSON.stringify(result));
};
