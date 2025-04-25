import { createSpinner } from "nanospinner";
import { startMCPCore } from "./actions/startMCP";

export const startMCP = async (packageName: string) => {
  const spinner = createSpinner(`[${packageName}] Starting`);
  spinner.start();

  try {
    const result = await startMCPCore(packageName);

    if (result.success) {
      spinner.success(result.message);
    } else {
      spinner.error(result.message);
    }
  } catch (error: any) {
    spinner.error(
      `[${packageName}] Failed to start: ${error.message || String(error)}`
    );
  }
};
