import { createSpinner } from "nanospinner";
import { getPM2StatusCore } from "./actions/getPM2Status";
import {
  displayAllStatuses,
  displaySingleStatus,
} from "./actions/displayStatus";

export const statusMCP = async (packageName: string): Promise<void> => {
  const spinner = createSpinner(
    `Retrieving status for ${packageName === "all" ? "all MCPs" : packageName}`
  );
  spinner.start();

  try {
    const result = await getPM2StatusCore(packageName);

    if (!result.success) {
      spinner.error(result.message);
      return;
    }

    spinner.success("Retrieved status information");

    if (packageName === "all" && Array.isArray(result.data)) {
      displayAllStatuses(result.data);
    } else if (result.data && !Array.isArray(result.data)) {
      displaySingleStatus(result.data);
    }
  } catch (error) {
    spinner.error(
      `Failed to get status: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};
