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

    // Validate package name format
    const parts = packageName.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return {
        success: false,
        message: "Invalid package name format. Expected 'user/repo'",
      };
    }

    // Get the package path
    const packagePath = join(mcpPath, packageName);
    const packageExists = existsSync(packagePath);

    if (!packageExists) {
      return {
        success: false,
        message: `not found\n     \x1b[2mTo view all installed repos, use: furi list\x1b[0m`,
      };
    }

    // Remove the package from the configuration file
    const configPath = join(mcpPath, "configuration.json");
    const configFile = Bun.file(configPath);
    const configExists = await configFile.exists();

    if (configExists) {
      try {
        const configContent = await configFile.text();
        if (configContent.trim()) {
          const config = JSON.parse(configContent);

          // Remove the package from the configuration
          if (config[packageName]) {
            delete config[packageName];
            await Bun.write(configPath, JSON.stringify(config, null, 2));
          }
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to update configuration: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    }

    // Delete the package directory using the $ shell API
    try {
      await Bun.$`rm -rf ${packagePath}`.quiet();
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete package directory: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    return {
      success: true,
      message: `Package ${packageName} removed`,
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
