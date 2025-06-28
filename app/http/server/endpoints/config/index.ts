import { resolveFromUserData } from "@/helpers/paths";
import { extractMcpName } from "@/http/server/utils";

export const getFullConfiguration = async () => {
  const configurationPath = await resolveFromUserData("configuration.json");
  let configuration = await Bun.file(configurationPath).json();

  // Get the specific MCP configuration
  for (const mcpName in configuration.installed) {
    const mcpConfig = configuration.installed[mcpName];

    // Remove env from the specific MCP configuration
    delete mcpConfig.env;

    configuration.installed[mcpName] = mcpConfig;
  }

  //   res.json(configuration);
  return new Response(JSON.stringify({ success: true, data: configuration }));
};
