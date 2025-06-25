import { resolveFromUserData } from "@/helpers/paths";
import { extractMcpName } from "@/http/server/utils";

export const saveEnvResponse = async (pathname: string, req: Request) => {
  const mcpNameResult = extractMcpName(pathname, "env");

  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }

  const mcpName = mcpNameResult;

  // Parse the JSON body correctly
  const requestBody = await req.json();

  // Store the env variables in configuration.json
  const configurationPath = await resolveFromUserData("configuration.json");
  let configuration = await Bun.file(configurationPath).json();

  // Merge new env variables with existing ones (add/replace)
  configuration.installed[mcpName].env = {
    ...(configuration.installed[mcpName].env || {}),
    ...requestBody,
  };

  await Bun.write(configurationPath, JSON.stringify(configuration, null, 2));

  return new Response(JSON.stringify({ success: true }));
};
