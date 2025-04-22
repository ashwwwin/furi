import { createSpinner } from "nanospinner";
import { validatePackage } from "./actions/validatePackage";
import { cloneRepo } from "./actions/cloneRepo";
import { initializePackage } from "./actions/initializePackage";

export const addPackage = async (packageName: string) => {
  const spinner = createSpinner(`[${packageName}] Installing`);
  let exitCode = 0;

  try {
    spinner.start();
    const result = await validatePackage(packageName);

    if (result.isInstalled) {
      return spinner.warn(
        `[${packageName}] Already installed\n     \x1b[2mTo uninstall, use: furi remove ${result.alias}\x1b[0m`
      );
    }

    if (!result.isValid)
      return spinner.error(`[${packageName}] Could not find repo`);

    await cloneRepo(result.packageUrl);
    await initializePackage(packageName);

    return spinner.success(`[${packageName}] Installed`);
  } catch (error) {
    exitCode = 1;
    return spinner.error(`[${packageName}] Failed to install`);
  } finally {
    spinner.stop();
    process.exit(exitCode);
  }
};
