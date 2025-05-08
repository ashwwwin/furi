import { join } from "path";
import { existsSync } from "node:fs";
import { stopMCPCore } from "@/mcp/stop/actions/stopMCP";
import {
  getPackagePath,
  resolveFromFurikake,
  getInstalledPath,
} from "@/helpers/paths";

type DeletePackageResult = {
  success: boolean;
  message: string;
};

export const deletePackage = async (
  mcpName: string
): Promise<DeletePackageResult> => {
  try {
    const configPath = resolveFromFurikake("configuration.json");
    const configFile = Bun.file(configPath);
    const configExists = await configFile.exists();
    let config: Record<
      string,
      { run: string; source: string; env?: Record<string, string> } | any
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

    // Check both root level and installed section for MCP configuration
    const mcpInRoot = config[mcpName] !== undefined;
    const mcpInInstalled =
      config.installed && config.installed[mcpName] !== undefined;

    if (!mcpInRoot && !mcpInInstalled) {
      // If no package is found, check one more edgecase
      // If the <author/repo> is installed, but the MCP Name is not
      if (mcpName.split("/").length === 2) {
        // console.log("Not found in configuration");
      } else {
        return {
          success: false,
          message: `Not found in configuration`,
        };
      }
    }

    try {
      await stopMCPCore(mcpName);
    } catch (stopError) {}

    let packageSourcePath;

    if (mcpInRoot && config[mcpName]?.source) {
      packageSourcePath = config[mcpName].source;
    } else if (mcpInInstalled && config.installed[mcpName]?.source) {
      packageSourcePath = config.installed[mcpName].source;
    }

    if (mcpName.split("/").length === 2) {
      const parts = mcpName.split("/");
      const owner = parts[0] || "";
      const repo = parts[1] || "";

      if (owner && repo) {
        packageSourcePath = getPackagePath(owner, repo);
      } else {
        // Fallback to using join with the installed path
        packageSourcePath = join(getInstalledPath(), mcpName);
      }
    }

    if (!packageSourcePath) {
      return {
        success: false,
        message: `${mcpName}' found in configuration but is missing the 'source' path`,
      };
    }

    const packageSourceDirExists = existsSync(packageSourcePath);

    // Remove from appropriate location
    if (mcpInRoot) {
      delete config[mcpName];
    } else if (mcpInInstalled) {
      delete config.installed[mcpName];
    }

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
      message: `Removed '${mcpName}'`,
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
