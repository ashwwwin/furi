import { createSpinner } from "nanospinner";
import { displayAllStatuses } from "../../mcp/status/actions/displayStatus";
import { getPM2StatusCore } from "../../mcp/status/actions/getPM2Status";

export const listPackages = async (showDetails: boolean) => {
  const spinner = createSpinner("Getting MCPs");
  spinner.start();

  const result = await getPM2StatusCore("all");

  if (!result.success) {
    return spinner.error("Failed to get MCPs");
  }
  if (Array.isArray(result.data)) {
    spinner.success(`${result.data.length} found\n`);
    displayAllStatuses(result.data, {
      showDetails: showDetails,
    });

    if (!showDetails) {
      console.log(
        "\n\x1b[2mIf you want to see server details use: furi status\x1b[0m"
      );
    }
  } else {
    spinner.error("Failed to get MCPs");
  }
};
