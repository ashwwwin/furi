import { createSpinner } from "nanospinner";
import { scanEnvVars } from "./actions/scanEnvVars";

export const getEnvironmentVariables = async (packageName: string) => {
  const spinner = createSpinner(
    `[${packageName}] Getting environment variables`
  );
  spinner.start();

  const result = await scanEnvVars(packageName);

  if (result.variables.length === 0) {
    spinner.success(`[${packageName}] No environment variables`);
    return;
  }

  spinner.success(`[${packageName}] Environment variables`);
  for (const variable of result.variables) {
    console.log(`     \x1b[2m${variable}=\x1b[0m`);
  }
};
