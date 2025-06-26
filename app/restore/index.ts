import { createSpinner } from "nanospinner";
import { restoreMCPsStateCore } from "./actions/restoreState";

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;

export const restoreMCPsState = async () => {
  let exitCode = 0;
  const spinner = createSpinner("Restoring MCPs state");

  try {
    spinner.start();

    const result = await restoreMCPsStateCore();

    if (!result.success) {
      spinner.error({ text: "Restore failed" });
      // Show details if available
      if (result.details && result.details.length > 0) {
        console.log(`\nDetails:`);
        result.details.forEach((detail) => {
          console.log(
            `   ${dim(`   [${detail.mcpName}] ${detail.action}:`)} ${
              detail.message
            }`
          );
        });
      }
      return;
    }

    const { restored, details } = result;
    const totalRestored =
      (restored?.start.length || 0) + (restored?.stop.length || 0);
    const totalProcessed = details?.length || 0;

    console.log(`\nRestore summary:`);
    // Please dim the text

    console.log(`   ${dim("Total MCPs found:")} ${totalProcessed}`);
    console.log(`   ${dim("Successfully restored:")} ${totalRestored}`);

    // Show detailed breakdown of each MCP
    if (details && details.length > 0) {
      console.log(`\nDetailed Results:`);
      details.forEach((detail) => {
        console.log(`   ${dim(detail.message)}`);
      });
    }

    const failures = details?.filter((d) => !d.success) || [];
    if (failures.length > 0) {
      console.log(`\n${failures.length} MCP(s) could not be restored:`);
      failures.forEach((failure) => {
        console.log(`   ${dim(failure.message)}`);
      });
      exitCode = 1;
    }

    if (totalRestored === 0 && totalProcessed === 0) {
      console.log(`\nNo MCPs found with recorded last actions to restore`);
    } else if (totalRestored === 0 && totalProcessed > 0) {
      console.log(
        `\nNo MCPs were successfully restored from ${totalProcessed} attempted operation(s)`
      );
    }

    console.log(``);
    spinner.success({ text: "MCPs state restored successfully" });
  } catch (error: any) {
    spinner.stop();
    exitCode = 1;
    console.log(`Unexpected error: ${error.message || String(error)}`);
  } finally {
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
};
