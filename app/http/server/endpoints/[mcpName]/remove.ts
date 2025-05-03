import { deletePackage } from "@/packages/remove/actions/deletePackage";
import { extractMcpName } from "@/http/server/utils"; // Adjusted path

export const removeResponse = async (pathname: string) => {
  // Extract mcpName from pathname
  const mcpNameResult = extractMcpName(pathname, "remove");

  // Handle potential Response error from mcpName extraction
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  // Use the extracted mcpName (which is now guaranteed to be a string)
  const mcpName = mcpNameResult;

  const result = await deletePackage(mcpName);
  return new Response(JSON.stringify({ success: true, data: result }));
};
