import { resolveFromUserData } from "@/helpers/paths";
import { extractMcpName } from "@/http/server/utils";

export const saveConfiguration = async (pathname: string, req: Request) => {
  const mcpNameResult = extractMcpName(pathname, "config");

  // Handle potential Response error from mcpName extraction
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  try {
    // If we got here, mcpNameResult is a string
    const mcpName = mcpNameResult;

    const configurationPath = await resolveFromUserData("configuration.json");
    let configuration = await Bun.file(configurationPath).json();

    // Get the specific MCP configuration
    const mcpConfig = configuration.installed[mcpName];

    // Replace the configuration with the new one
    // (eg. only replace the inputs of the configuration, don't replace any config that does not presently exist)
    const newConfig = await req.json();
    Object.keys(newConfig).forEach((key) => {
      if (mcpConfig[key]) {
        mcpConfig[key] = newConfig[key];
      }
    });

    // Save the configuration
    configuration.installed[mcpName] = mcpConfig;
    await Bun.write(configurationPath, JSON.stringify(configuration, null, 2));

    return new Response(JSON.stringify({ success: true, data: mcpConfig }));
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to save configuration: ${error}`,
      })
    );
  }
};
