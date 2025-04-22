import { createSpinner } from "nanospinner";
import { deletePackage } from "./actions/deletePackage";

export const removePackage = async (packageName: string) => {
  const spinner = createSpinner(`[${packageName}] Removing`);
  let exitCode = 0;

  try {
    spinner.start();

    const result = await deletePackage(packageName);

    if (!result.success) {
      return spinner.error(`[${packageName}] ${result.message}`);
    }

    return spinner.success(`[${packageName}] Removed`);
  } catch (error) {
    exitCode = 1;
    return spinner.error(
      `[${packageName}] Failed to remove: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    spinner.stop();
    process.exit(exitCode);
  }
};
