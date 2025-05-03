import { getProcStatus } from "@/mcp/status/actions/getProcStatus";

export const statusResponse = async () => {
  const result = await getProcStatus("all");
  if (result.success) {
    return new Response(
      JSON.stringify({
        success: true,
        data: result.data,
      })
    );
  }
  return new Response(
    JSON.stringify({ success: false, message: "Failed to get MCPs" })
  );
};
