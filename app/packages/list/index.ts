import { createSpinner } from "nanospinner";
import { join } from "path";

export const listPackages = async () => {
  const spinner = createSpinner("Listing packages");
  spinner.start();

  try {
    const mcpPath = process.env.MCP_PATH;
    if (!mcpPath) {
      return spinner.error("MCP_PATH environment variable is not set");
    }

    const configPath = join(mcpPath, "configuration.json");
    const configFile = Bun.file(configPath);

    const exists = await configFile.exists();
    if (!exists) {
      return spinner.error(`Configuration file not found at ${configPath}`);
    }

    const configContent = await configFile.text();
    if (!configContent.trim()) {
      return spinner.success("No packages installed");
    }

    const config = JSON.parse(configContent);
    const packages = Object.keys(config);

    if (packages.length === 0) {
      return spinner.success("No packages installed");
    }

    spinner.success(`Found ${packages.length} installed MCPs`);
    packages.forEach((pkg) => {
      console.log(`     \x1b[2m- ${pkg}\x1b[0m`);
    });
  } catch (error) {
    return spinner.error(
      `Failed to list packages: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};
