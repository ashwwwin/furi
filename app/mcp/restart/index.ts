import { createSpinner } from "nanospinner";
import { stopMCPCore } from "../stop/actions/stopMCP";
import { startMCPCore } from "../start/actions/startMCP";

export const restartMCP = async (packageName: string) => {
  const spinner = createSpinner(`Restarting ${packageName}`);
  spinner.start();
  try {
    const stopResult = await stopMCPCore(packageName);
    if (!stopResult.success) {
      spinner.error(
        `Failed to stop ${packageName}\n     \x1b[2m${stopResult.message}\x1b[0m`
      );
      return;
    }

    const startResult = await startMCPCore(packageName);
    if (!startResult.success) {
      spinner.error(
        `Failed to start ${packageName}\n     \x1b[2m${startResult.message}\x1b[0m`
      );
      return;
    }

    spinner.success({ text: `Restarted ${packageName}` });
  } catch (error) {
    spinner.error({
      text: `Failed to restart ${packageName}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    process.exit(1);
  }
};
