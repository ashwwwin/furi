import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

type PackageOutput = {
  success: boolean;
  message: string;
  runCommand?: string;
};

// The goal of this function is to initialize the package
// Get it to the point where it can be used by the user
export const initializePackage = async (
  packageName: string
): Promise<PackageOutput> => {
  try {
    const mcpPath = process.env.MCP_PATH;
    if (!mcpPath) {
      return {
        success: false,
        message: "MCP_PATH environment variable is not set",
      };
    }

    // Get the package path
    const parts = packageName.split("/");
    const [author, repo] = parts;

    if (parts.length !== 2 || !author || !repo) {
      return {
        success: false,
        message: "Invalid package name format. Expected 'user/repo'",
      };
    }

    const packagePath = join(mcpPath as string, author, repo);
    const packageExists = existsSync(packagePath);

    if (!packageExists) {
      return {
        success: false,
        message: `Package directory not found at ${packagePath}`,
      };
    }

    // Check if package.json exists
    const packageJsonPath = join(packagePath, "package.json");
    const packageJsonExists = existsSync(packageJsonPath);

    if (!packageJsonExists) {
      return {
        success: false,
        message: "Not a Node.js package: package.json not found",
      };
    }

    // Read and parse package.json
    const packageJsonContent = readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);
    const hasTsConfig = existsSync(join(packagePath, "tsconfig.json"));

    // Determine run command based on package.json scripts
    let runCommand = "";
    let buildCommand = null;

    const scripts = packageJson.scripts || {};

    // Check for build script
    if (scripts.build) {
      buildCommand = "build";
    }

    // Determine run command based on available scripts
    if (scripts.start) {
      runCommand = "start";
    } else if (scripts.dev) {
      runCommand = "dev";
    } else if (scripts.serve) {
      runCommand = "serve";
    } else {
      // If no obvious run script, check for bin entry
      if (packageJson.bin) {
        const binEntry =
          typeof packageJson.bin === "string"
            ? packageJson.bin
            : Object.values(packageJson.bin)[0];

        if (binEntry) {
          // If the package has a binary, run that directly
          runCommand = "node " + binEntry;
        }
      }
    }

    // Install dependencies
    try {
      // Just install dependencies with no build step by default
      await Bun.$`cd ${packagePath} && npm install --ignore-scripts`.quiet();

      // Skip TypeScript build if there are issues with types
      if (hasTsConfig) {
        // TypeScript handling could go here if needed
      } else if (buildCommand) {
        // Only run build for non-TypeScript projects or if forced
        try {
          await Bun.$`cd ${packagePath} && npm run ${buildCommand}`.quiet();
        } catch (buildError) {
          console.warn(
            `Build step failed, but continuing with installation: ${
              buildError instanceof Error
                ? buildError.message
                : String(buildError)
            }`
          );
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to initialize package: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    // Format the final run command
    const finalRunCommand = runCommand.startsWith("node ")
      ? runCommand
      : `npm run ${runCommand}`;

    // Update configuration.json
    const configPath = join(mcpPath as string, "configuration.json");
    const configExists = existsSync(configPath);

    let config: Record<string, { run: string; source: string }> = {};

    try {
      if (configExists) {
        try {
          const configContent = readFileSync(configPath, "utf-8");
          // Only try to parse if there's actual content
          if (configContent.trim()) {
            config = JSON.parse(configContent);
          }
        } catch (parseError) {
          console.warn(
            `Invalid configuration file, creating a new one: ${
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            }`
          );
        }
      }

      config[packageName] = {
        run: finalRunCommand,
        source: packagePath,
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    } catch (error) {
      return {
        success: false,
        message: `Failed to update configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    return {
      success: true,
      message: `Package ${packageName} initialized successfully`,
      runCommand: finalRunCommand,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to initialize package: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};
