import { join } from "path";
import { existsSync } from "node:fs";

type DeletePackageResult = {
  success: boolean;
  message: string;
};

export const deletePackage = async (
  packageName: string
): Promise<DeletePackageResult> => {
  try {
    const mcpPath = process.env.MCP_PATH;
    if (!mcpPath) {
      return {
        success: false,
        message: "MCP_PATH environment variable is not set",
      };
    }

    const configPath = join(mcpPath, "configuration.json");
    const configFile = Bun.file(configPath);
    const configExists = await configFile.exists();
    let config: Record<
      string,
      { run: string; source: string; env?: Record<string, string> }
    > = {};

    if (configExists) {
      try {
        const configContent = await configFile.text();
        if (configContent.trim()) {
          config = JSON.parse(configContent);
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to read or parse configuration: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    }

    if (!config[packageName]) {
      return {
        success: false,
        message: `Package '${packageName}' not found in configuration.`,
      };
    }

    const packageSourcePath = config[packageName].source;
    if (!packageSourcePath) {
      return {
        success: false,
        message: `Package '${packageName}' found in configuration but is missing the 'source' path.`,
      };
    }

    const packageSourceDirExists = existsSync(packageSourcePath);

    delete config[packageName];

    try {
      await Bun.write(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      return {
        success: false,
        message: `Failed to write updated configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    if (packageSourceDirExists) {
      try {
        await Bun.$`rm -rf ${packageSourcePath}`.quiet();
      } catch (error) {
        console.warn(
          `Failed to delete package directory '${packageSourcePath}': ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return {
      success: true,
      message: `Removed '${packageName}'`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to remove package: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};
