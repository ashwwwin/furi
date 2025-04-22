import { join } from "path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";

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

    // Check if it's an ES module
    const isEsm = packageJson.type === "module";

    // Determine run command based on package.json scripts
    let runCommand = "";
    let buildCommand = null;

    const scripts = packageJson.scripts || {};

    // Check for build script options in order of preference
    if (scripts.build) {
      buildCommand = "build";
    } else if (scripts.compile) {
      buildCommand = "compile";
    } else if (scripts.prepublish) {
      buildCommand = "prepublish";
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

    // Install dependencies but skip the build step
    try {
      // Install dependencies but skip scripts to avoid build issues
      await Bun.$`cd ${packagePath} && npm install --ignore-scripts`.quiet();

      let buildSuccessful = false;

      // First check if the package already has a dist/ or lib/ directory with compiled JS
      const hasDistDir = existsSync(join(packagePath, "dist"));
      const hasLibDir = existsSync(join(packagePath, "lib"));

      if (hasDistDir || hasLibDir) {
        // console.log(`Package already has compiled JavaScript files`);
        buildSuccessful = true;
      } else {
        // Check if we need to run a build
        const needsBuild = hasTsConfig || buildCommand;

        if (needsBuild) {
          // Let's first try the normal build process
          if (buildCommand) {
            try {
              //   console.log(`Running build command: npm run ${buildCommand}`);
              await Bun.$`cd ${packagePath} && npm run ${buildCommand}`.quiet();
              //   console.log(`Build completed successfully`);
              buildSuccessful = true;
            } catch (buildError) {
              //   console.warn(`Build failed: ${String(buildError)}`);
            }
          }

          // If build failed or there was no build command but we have TypeScript
          if (!buildSuccessful && hasTsConfig) {
            // console.log(`Attempting to handle TypeScript files manually`);

            // Check for TypeScript files in various locations
            const entryPoints = [
              {
                path: join(packagePath, "src", "index.ts"),
                relativePath: "../src/index.ts",
              },
              {
                path: join(packagePath, "index.ts"),
                relativePath: "../index.ts",
              },
              {
                path: join(packagePath, "src", "main.ts"),
                relativePath: "../src/main.ts",
              },
              {
                path: join(packagePath, "main.ts"),
                relativePath: "../main.ts",
              },
            ];

            let foundTsFile = null;
            for (const entry of entryPoints) {
              if (existsSync(entry.path)) {
                foundTsFile = entry;
                // console.log(`Found TypeScript entry point at ${entry.path}`);
                break;
              }
            }

            if (foundTsFile) {
              // Create dist directory if it doesn't exist
              const distDir = join(packagePath, "dist");
              if (!existsSync(distDir)) {
                mkdirSync(distDir, { recursive: true });
                // console.log(`Created dist directory`);
              }

              // Create the appropriate wrapper based on module type
              if (isEsm) {
                // ESM wrapper
                const esmWrapper = `
// This is an automatically generated ESM wrapper for TypeScript files
import { register } from 'ts-node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Register ts-node
register({ transpileOnly: true, swc: true });

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the TypeScript file
const srcPath = join(__dirname, '${foundTsFile.relativePath}');

// Dynamic import with error handling
export default async function init() {
  try {
    return await import(srcPath);
  } catch (error) {
    console.error('Error loading TypeScript files:', error);
    throw error;
  }
}

// Initialize
init().catch(err => {
  console.error(err);
  process.exit(1);
});
`;
                writeFileSync(join(distDir, "index.js"), esmWrapper, "utf-8");

                // Create package.json in dist to make it an ES module
                const distPackageJson = {
                  type: "module",
                };
                writeFileSync(
                  join(distDir, "package.json"),
                  JSON.stringify(distPackageJson, null, 2),
                  "utf-8"
                );
              } else {
                // CommonJS wrapper
                const cjsWrapper = `
// This is an automatically generated CommonJS wrapper for TypeScript files
try {
  require('ts-node/register');
  module.exports = require('${foundTsFile.relativePath}');
} catch (error) {
  console.error('Error loading TypeScript files:', error);
  throw error;
}
`;
                writeFileSync(join(distDir, "index.js"), cjsWrapper, "utf-8");
              }

              //   console.log(
              //     `Created ${
              //       isEsm ? "ESM" : "CommonJS"
              //     } wrapper for TypeScript entry point at ${foundTsFile.path}`
              //   );

              // Add ts-node as a dependency
              try {
                await Bun.$`cd ${packagePath} && npm install --save-dev ts-node typescript @swc/core`.quiet();
                // console.log(
                //   `Installed ts-node and dependencies for runtime TypeScript support`
                // );
                buildSuccessful = true;
              } catch (installError) {
                // console.warn(
                //   `Failed to install ts-node: ${String(installError)}`
                // );
              }
            } else {
              //   console.warn(`Could not find TypeScript entry point`);
            }
          }
        } else {
          // If the package doesn't have TypeScript or a build command, just mark as successful
          //   console.log(`Package doesn't require building`);
          buildSuccessful = true;
        }
      }

      //   console.log(
      //     `Package setup completed${
      //       buildSuccessful ? " successfully" : " with warnings"
      //     }`
      //   );
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
      message: `${packageName} initialized successfully`,
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
