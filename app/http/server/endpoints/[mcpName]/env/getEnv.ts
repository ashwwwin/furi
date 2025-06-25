import { getEnv, scanEnvVars } from "@/mcp/env/actions/scanEnvVars";
import { extractMcpName } from "../../../utils";
import { resolveFromUserData } from "@/helpers/paths";

export async function envResponse(pathname: string): Promise<Response> {
  const mcpNameResult = extractMcpName(pathname, "env");

  // Handle potential Response error from mcpName extraction
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  const mcpName = mcpNameResult;
  const env = await scanEnvVars(mcpName);

  // Read env that is already filled in from the configuration
  const configurationPath = await resolveFromUserData("configuration.json");
  let configuration = await Bun.file(configurationPath).json();

  // Remove the actual data from the env object (so that it is not filled in) before we pass it to the client
  // When we pass `filled` to the client, it should only show environment variables that are already filled in (without the data)
  // When we pass `env` to the client, it should show all environment variables

  const filled = configuration.installed[mcpName].env
    ? Object.keys(configuration.installed[mcpName].env)
    : [];

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        all: env.variables || [],
        filled: filled,
      },
    })
  );
}
