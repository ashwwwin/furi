import { createSpinner } from "nanospinner";
import { validatePackage } from "./actions/validatePackage";
import { cloneRepo } from "./actions/cloneRepo";
import { initializePackage } from "./actions/initializePackage";
import { join } from "path";
import { deletePackage } from "../remove/actions/deletePackage";
import { getPackagePath, getInstalledPath } from "@/helpers/paths";
import { readConfig, writeConfig } from "@/helpers/config";
import { resolveFromUserData } from "@/helpers/paths";

export const addPackage = async (mcpName: string) => {
  const spinner = createSpinner(`[${mcpName}] Installing`);
  let exitCode = 0;

  try {
    spinner.start();
    const result = await validatePackage(mcpName);

    if (result.isInstalled) {
      let alias: string | undefined = result.alias || undefined;

      return spinner.warn(
        `[${mcpName}] Already installed\n     \x1b[2mTo uninstall, use: furi remove ${alias}\x1b[0m`
      );
    }

    if (!result.isValid)
      return spinner.error(`[${mcpName}] Could not find repo`);

    await cloneRepo(result.packageUrl);
    const response = await initializePackage(mcpName, spinner);

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

      // Extract owner and repo name safely
      const parts = mcpName.split("/");
      const owner = parts[0] || "";
      const repo = parts[1] || "";

      // Use the installed path if we can't get owner and repo
      const packagePath =
        owner && repo
          ? getPackagePath(owner, repo)
          : join(getInstalledPath(), mcpName);

      // Update configuration.json to register the package even though build failed
      try {
        const config = readConfig();

        if (!config.installed) {
          config.installed = {};
        }

        const socketPath = resolveFromUserData(
          `/transport/furi_${mcpName.replace("/", "-")}.sock`
        );

        // Add the package to configuration with a note that it needs manual setup
        config.installed[mcpName] = {
          run: null, // No run command since build failed
          source: packagePath,
          socketPath: socketPath,
          originalRun: null,
          transportWrapper: false,
        };

        writeConfig(config);

        console.log(
          `     \x1b[2mYou can edit the package in ${packagePath}\x1b[0m`
        );
        console.log(
          `     \x1b[2mPackage registered in configuration but requires manual setup\x1b[0m`
        );
      } catch (error) {
        console.error(
          `     \x1b[31mFailed to update configuration: ${
            error instanceof Error ? error.message : String(error)
          }\x1b[0m`
        );
      }

      return;
    }

    return spinner.success(`[${mcpName}] Installed`);
  } catch (error) {
    exitCode = 1;
    return spinner.error(`[${mcpName}] Failed to install`);
  } finally {
    spinner.stop();
    if (exitCode !== 0) {
      // Optionally, if you need to ensure a non-zero exit code for scripting when errors occur:
      // process.exitCode = exitCode; // This sets the exit code for when Bun exits naturally
    }
  }
};
