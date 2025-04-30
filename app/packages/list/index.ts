import { createSpinner } from "nanospinner";
import { displayStatus } from "../../mcp/status/actions/displayStatus";
import { getProcStatus } from "../../mcp/status/actions/getProcStatus";

export const listPackages = async (showDetails: boolean) => {
  const spinner = createSpinner("Getting MCPs");
  spinner.start();

  const result = await getProcStatus("all");

  if (!result.success) {
    return spinner.error("Failed to get MCPs");
  }

  if (Array.isArray(result.data)) {
    spinner.success(`${result.data.length} found\n`);
    displayStatus(result.data, {
      showDetails: showDetails,
    });

    if (!showDetails) {
      console.log("\n\x1b[2mTo see server details use: furi status\x1b[0m");
    }
  } else {
    spinner.error("Failed to get MCPs");
  }
};
