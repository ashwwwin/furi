import { resolveFromUserData } from "@/helpers/paths";
import { extractMcpName } from "@/http/server/utils";

export const readConfiguration = async (pathname: string) => {
  const mcpNameResult = extractMcpName(pathname, "config");

  // Handle potential Response error from mcpName extraction
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  // If we got here, mcpNameResult is a string
  const mcpName = mcpNameResult;

  const configurationPath = await resolveFromUserData("configuration.json");
  let configuration = await Bun.file(configurationPath).json();

  // Get the specific MCP configuration
  const mcpConfig = configuration.installed[mcpName];

  if (!mcpConfig) {
    return new Response(
      JSON.stringify({ success: false, error: "MCP not found" })
    );
  }

  // Remove env from the specific MCP configuration
  delete mcpConfig.env;

  //   res.json(configuration);
  return new Response(JSON.stringify({ success: true, data: mcpConfig }));
};
