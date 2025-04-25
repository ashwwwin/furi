import { createSpinner } from "nanospinner";
import { scanEnvVars } from "./actions/scanEnvVars";

export const getEnvironmentVariables = async (mcpName: string) => {
  const spinner = createSpinner(`[${mcpName}] Getting environment variables`);
  spinner.start();

  const result = await scanEnvVars(mcpName);

  if (result.variables.length === 0) {
    spinner.success(`[${mcpName}] No environment variables`);
    return;
  }

  spinner.success(`[${mcpName}] Environment variables`);
  for (const variable of result.variables) {
    console.log(`     \x1b[2m${variable}=\x1b[0m`);
  }
};
