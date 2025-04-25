import { createSpinner } from "nanospinner";
import { stopMCPCore } from "./actions/stopMCP";

export const stopMCP = async (mcpName: string) => {
  const spinner = createSpinner(`[${mcpName}] Stopping`);
  spinner.start();

  try {
    const result = await stopMCPCore(mcpName);

    if (result.success) {
      spinner.success(result.message);
    } else {
      spinner.error(result.message);
    }
  } catch (error: any) {
    spinner.error(
      `[${mcpName}] Failed to stop: ${error.message || String(error)}`
    );
  }
};
