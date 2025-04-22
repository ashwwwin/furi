import { createSpinner } from "nanospinner";
import { readFileSync } from "fs";
import { join } from "path";

export const startMCP = async (packageName: string) => {
  const spinner = createSpinner(`[${packageName}] Starting`);
  spinner.start();

  try {
    // Read the configuration.json file
    const configPath = join(process.cwd(), ".installed/configuration.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    // Get the run command for the package
    if (!config[packageName]) {
      spinner.error(`[${packageName}] Configuration not found`);
      return;
    }

    const runCommand = config[packageName].run || "npm run start";
    const [cmd, ...args] = runCommand.split(" ");

    // Use the source directory from config if available, otherwise fall back to default
    const cwd = config[packageName].source || `.installed/${packageName}`;

    await Bun.spawn([cmd, ...args], {
      cwd,
      stdout: "inherit",
      stderr: "inherit",
    });

    spinner.success(`[${packageName}] Started`);
  } catch (error: any) {
    spinner.error(
      `[${packageName}] Failed to start: ${error.message || String(error)}`
    );
  }
};
