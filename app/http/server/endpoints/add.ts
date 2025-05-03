import { addPackage } from "@/packages/add";
import { initializePackage } from "@/packages/add/actions/initializePackage";
import { validatePackage } from "@/packages/add/actions/validatePackage";
import { extractMcpName } from "../utils"; // Import mcpName utility

export const addResponse = async (pathname: string) => {
  // Extract mcpName from pathname
  const mcpNameResult = extractMcpName(pathname, "add");

  // Handle potential Response error from mcpName extraction
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  // Use the extracted mcpName (which is now guaranteed to be a string)
  const mcpName = mcpNameResult;

  // mcpName is expected to be in 'author/repo' format
  if (!mcpName || !mcpName.includes("/")) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid mcpName format after extraction",
      }),
      { status: 400 }
    );
  }

  const result = await validatePackage(mcpName);

  if (result.isValid && !result.isInstalled) {
    const installResult = await addPackage(mcpName);

    if (installResult?.success) {
      const initializeResult = await initializePackage(mcpName);
      return new Response(
        JSON.stringify({
          success: true,
          data: initializeResult,
        })
      );
    }

    return new Response(JSON.stringify({ success: false, ...installResult }));
  }

  return new Response(JSON.stringify({ success: false, ...result }));
};
