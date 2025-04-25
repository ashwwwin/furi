import { createSpinner } from "nanospinner";
import { stopMCPCore } from "../stop/actions/stopMCP";
import { startMCPCore } from "../start/actions/startMCP";

export const restartMCP = async (mcpName: string) => {
  const spinner = createSpinner(`Restarting ${mcpName}`);
  spinner.start();
  try {
    const stopResult = await stopMCPCore(mcpName);
    if (!stopResult.success) {
      spinner.error(
        `Failed to stop ${mcpName}\n     \x1b[2m${stopResult.message}\x1b[0m`
      );
      return;
    }

    const startResult = await startMCPCore(mcpName);
    if (!startResult.success) {
      spinner.error(
        `Failed to start ${mcpName}\n     \x1b[2m${startResult.message}\x1b[0m`
      );
      return;
    }

    spinner.success({ text: `Restarted ${mcpName}` });
  } catch (error) {
    spinner.error({
      text: `Failed to restart ${mcpName}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    process.exit(1);
  }
};
