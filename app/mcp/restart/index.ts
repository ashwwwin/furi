import { createSpinner } from "nanospinner";
import { restartMCPCore } from "./actions/restartMCP";

export const restartMCP = async (mcpName: string) => {
  const spinner = createSpinner(`Restarting ${mcpName}`);
  spinner.start();

  try {
    const result = await restartMCPCore(mcpName);

    if (result.success) {
      spinner.success({ text: result.message });
    } else {
      spinner.error({ text: result.message });
      process.exit(1);
    }
  } catch (error) {
    spinner.error({
      text: `Unexpected error during restart: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    process.exit(1);
  }
};
