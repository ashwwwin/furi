import { getProcStatus } from "../../../mcp/status/actions/getProcStatus";

export const listResponse = async (showAll = false) => {
  const result = await getProcStatus("all");

  if (result.success) {
    if (Array.isArray(result.data)) {
      let names: string[] = [];

      if (showAll) {
        names = result.data.map((mcp) => mcp.name);
      } else {
        names = result.data
          .filter((mcp) => mcp.pid !== "N/A")
          .map((mcp) => mcp.name);
      }

      return new Response(JSON.stringify(names));
    }
    return new Response(
      JSON.stringify({ success: false, message: "No MCPs found" })
    );
  }
  return new Response(
    JSON.stringify({ success: false, message: "Failed to get MCPs" })
  );
};
