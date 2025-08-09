import { getProcStatus } from "@/mcp/status/actions/getProcStatus";

let listCache: { timestamp: number; data: any[] } | null = null;
const LIST_CACHE_TTL_MS = 500; // leverage pm2 list TTL; this aligns with internal cache

export const listResponse = async (showAll = false) => {
  const now = Date.now();
  if (listCache && now - listCache.timestamp < LIST_CACHE_TTL_MS) {
    const names = showAll
      ? listCache.data.map((mcp: any) => mcp.name)
      : listCache.data
          .filter((mcp: any) => mcp.pid !== "N/A")
          .map((mcp: any) => mcp.name);
    return new Response(JSON.stringify({ success: true, data: names }));
  }

  const result = await getProcStatus("all");

  if (result.success) {
    if (Array.isArray(result.data)) {
      listCache = { timestamp: now, data: result.data };

      let names: string[] = [];

      if (showAll) {
        names = result.data.map((mcp) => mcp.name);
      } else {
        names = result.data
          .filter((mcp) => mcp.pid !== "N/A")
          .map((mcp) => mcp.name);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: names,
        })
      );
    }
    return new Response(
      JSON.stringify({ success: false, message: "No MCPs found" })
    );
  }
  return new Response(
    JSON.stringify({ success: false, message: "Failed to get MCPs" })
  );
};
