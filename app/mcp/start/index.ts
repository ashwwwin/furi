import { createSpinner } from "nanospinner";
import { startMCPCore } from "./actions/startMCP";

export const startMCP = async (mcpName: string) => {
  const spinner = createSpinner(`[${mcpName}] Starting`);
  spinner.start();

  try {
    const result = await startMCPCore(mcpName);

    if (result.success) {
      spinner.success(result.message);
    } else {
      spinner.error(result.message);
    }
  } catch (error: any) {
    spinner.error(
      `[${mcpName}] Failed to start: ${error.message || String(error)}`
    );
  }
};
