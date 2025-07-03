import { addPackage } from "@/packages/add";
import { initializePackage } from "@/packages/add/actions/initializePackage";
import { validatePackage } from "@/packages/add/actions/validatePackage";
import { extractMcpName } from "../utils"; // Import mcpName utility
import { cloneRepo } from "@/packages/add/actions/cloneRepo";

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
        message: "Invalid package name format. Expected format: 'author/repo'",
      }),
      { status: 400 }
    );
  }

  const result = await validatePackage(mcpName);

  // Check if already installed
  if (result.isInstalled) {
    return new Response(
      JSON.stringify({
        success: false,
        message: `Package '${mcpName}' is already installed`,
        alias: result.alias,
      }),
      { status: 409 }
    );
  }

  // Check if repository exists
  if (!result.isValid) {
    return new Response(
      JSON.stringify({
        success: false,
        message:
          result.error ||
          `GitHub repository '${mcpName}' not found or inaccessible`,
      }),
      { status: 404 }
    );
  }

  // Clone the repository
  const cloneResult = await cloneRepo(result.packageUrl);

  if (!cloneResult.success) {
    return new Response(
      JSON.stringify({
        success: false,
        message: `Failed to clone repository: ${
          cloneResult.error || "Unknown error"
        }`,
      }),
      { status: 500 }
    );
  }

  // Initialize the package
  const initializeResult = await initializePackage(mcpName);

  if (!initializeResult.success) {
    return new Response(
      JSON.stringify({
        success: false,
        message:
          initializeResult.message ||
          `Failed to initialize package '${mcpName}'`,
      }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Successfully installed '${mcpName}'`,
      data: initializeResult,
    }),
    { status: 200 }
  );
};
