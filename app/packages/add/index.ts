import { createSpinner } from "nanospinner";
import { validatePackage } from "./actions/validatePackage";
import { cloneRepo } from "./actions/cloneRepo";
import { initializePackage } from "./actions/initializePackage";
import { join } from "path";

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
    const response = await initializePackage(packageName);

    if (!response.success) {
      spinner.warn(`Failed to build\n     \x1b[2m${response.message}\x1b[0m`);

      // Write the prompt to stdout
      process.stdout.write(
        `\n[${packageName}] Do you want to keep the repo? (y/n) `
      );

      // Read user input from stdin
      let input = "";
      for await (const line of console) {
        input = line;
        break; // Just read one line
      }

      if (input.trim().toLowerCase() !== "y") {
        // Delete the package directory if the build failed
        const basePath = process.env.BASE_PATH;
        if (basePath) {
          const packagePath = join(basePath, packageName);
          await Bun.$`rm -rf ${packagePath}`.quiet();
        }

        spinner.error(`[${packageName}] Failed to install`);

        return;
      }

      spinner.warn(`[${packageName}] Failed to build but downloaded`);
      console.log(
        `     \x1b[2mYou can edit the package in ${join(
          process.env.BASE_PATH + ".furikake/installed",
          packageName
        )}\x1b[0m`
      );

      return;
    }

    return spinner.success(`[${packageName}] Installed`);
  } catch (error) {
    exitCode = 1;
    return spinner.error(`[${packageName}] Failed to install`);
  } finally {
    spinner.stop();
    process.exit(exitCode);
  }
};
