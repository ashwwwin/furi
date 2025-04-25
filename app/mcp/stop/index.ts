import { createSpinner } from "nanospinner";
import { stopMCPCore } from "./actions/stopMCP";

export const stopMCP = async (packageName: string) => {
  const spinner = createSpinner(`[${packageName}] Stopping`);
  spinner.start();

  try {
    const result = await stopMCPCore(packageName);

    if (result.success) {
      spinner.success(result.message);
    } else {
      spinner.error(result.message);
    }
  } catch (error: any) {
    spinner.error(
      `[${packageName}] Failed to stop: ${error.message || String(error)}`
    );
  }
};
