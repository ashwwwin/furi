import { stopMCPCore } from "../../stop/actions/stopMCP";
import { startMCPCore } from "../../start/actions/startMCP";

export const restartMCPCore = async (
  mcpName: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const stopResult = await stopMCPCore(mcpName);
    // Only fail stop if the process was actually found and failed to stop.
    // If it wasn't found, that's okay for a restart, we just need to start it.
    if (
      !stopResult.success &&
      !stopResult.message.includes("Process not found")
    ) {
      return {
        success: false,
        message: `Failed to stop: ${stopResult.message}`,
      };
    }

    const startResult = await startMCPCore(mcpName);
    if (!startResult.success) {
      return {
        success: false,
        message: `Failed to start: ${startResult.message}`,
      };
    }

    return { success: true, message: `[${mcpName}] restarted successfully` };
  } catch (error: any) {
    return {
      success: false,
      message: `[${mcpName}] Failed to restart: ${
        error.message || String(error)
      }`,
    };
  }
};
