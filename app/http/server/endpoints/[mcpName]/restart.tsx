import { restartMCPCore } from "../../../../mcp/restart/actions/restartMCP";

export const restartResponse = async (pathname: string) => {
  // Extract mcpName from the path, e.g. /foo/restart => foo
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || typeof parts[0] !== "string" || parts[0].length === 0) {
    return new Response(
      JSON.stringify({ success: false, message: "Invalid path format for restart" })
    );
  }
  const mcpName = parts[0];

  const result = await restartMCPCore(mcpName);
  return new Response(JSON.stringify(result));
};
