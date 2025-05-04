import { createSpinner } from "nanospinner";
import { validatePackage } from "./actions/validatePackage";
import { cloneRepo } from "./actions/cloneRepo";
import { initializePackage } from "./actions/initializePackage";
import { join } from "path";
import { deletePackage } from "../remove/actions/deletePackage";

export const addPackage = async (mcpName: string) => {
  const spinner = createSpinner(`[${mcpName}] Installing`);
  let exitCode = 0;

  try {
    spinner.start();
    const result = await validatePackage(mcpName);

    if (result.isInstalled) {
      const basePath = process.env.BASE_PATH || "";
      if (!basePath) {
        throw new Error("BASE_PATH environment variable is not set");
      }

      let alias: string | undefined = result.alias || undefined;

      return spinner.warn(
        `[${mcpName}] Already installed\n     \x1b[2mTo uninstall, use: furi remove ${alias}\x1b[0m`
      );
    }

    if (!result.isValid)
      return spinner.error(`[${mcpName}] Could not find repo`);

    await cloneRepo(result.packageUrl);
    const response = await initializePackage(mcpName);

    if (!response.success) {
      spinner.warn(`Failed to build\n     \x1b[2m${response.message}\x1b[0m`);

      // Write the prompt to stdout
      process.stdout.write(
        `\n[${mcpName}] Do you want to keep the repo? (y/n) `
      );

      // Read user input from stdin
      let input = "";
      for await (const line of console) {
        input = line;
        break;
      }

      if (input.trim().toLowerCase() !== "y") {
        // Delete the package directory if the build failed
        await deletePackage(mcpName);

        spinner.error(`[${mcpName}] Failed to install`);

        return;
      }

      spinner.warn(`[${mcpName}] Failed to build but downloaded`);
      console.log(
        `     \x1b[2mYou can edit the package in ${join(
          process.env.BASE_PATH + ".furikake/installed",
          mcpName
        )}\x1b[0m`
      );

      return;
    }

    return spinner.success(`[${mcpName}] Installed`);
  } catch (error) {
    exitCode = 1;
    return spinner.error(`[${mcpName}] Failed to install`);
  } finally {
    spinner.stop();
    process.exit(exitCode);
  }
};
