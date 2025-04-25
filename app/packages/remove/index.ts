import { createSpinner } from "nanospinner";
import { deletePackage } from "./actions/deletePackage";

export const removePackage = async (mcpName: string) => {
  const spinner = createSpinner(`[${mcpName}] Removing`);
  let exitCode = 0;

  try {
    spinner.start();

    const result = await deletePackage(mcpName);

    if (!result.success) {
      return spinner.error(`[${mcpName}] ${result.message}`);
    }

    return spinner.success(`[${mcpName}] Removed`);
  } catch (error) {
    exitCode = 1;
    return spinner.error(
      `[${mcpName}] Failed to remove: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    spinner.stop();
    process.exit(exitCode);
  }
};
