import { join, relative, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import yaml from "js-yaml";

type PackageOutput = {
  success: boolean;
  message: string;
  runCommand?: string;
};

// Define the structure expected in smithery.yaml
type SmitheryConfig = {
  commandFunction?: {
    build?: string;
    run?: string;
  };
};

// The goal of this function is to initialize the package
// Get it to the point where it can be used by the user
export const initializePackage = async (
  mcpName: string
): Promise<PackageOutput> => {
  try {
    const basePath = process.env.BASE_PATH;
    if (!basePath) {
      return {
        success: false,
        message: "BASE_PATH environment variable is not set",
      };
    }

    // Get the package path
    const parts = mcpName.split("/");
    const [author, repo] = parts;

    if (parts.length !== 2 || !author || !repo) {
      return {
        success: false,
        message: "Invalid MCP Name format. Expected 'user/repo'",
      };
    }

    const packagePath = join(
      basePath as string,
      ".furikake/installed",
      author,
      repo
    );
    const packageExists = existsSync(packagePath);

    if (!packageExists) {
      return {
        success: false,
        message: `Package directory not found at ${packagePath}`,
      };
    }

    // Check if smithery.yaml exists
    const smitheryPath = join(packagePath, "smithery.yaml");
    const smitheryExists = existsSync(smitheryPath);
    let smitheryConfig: SmitheryConfig = {};

    if (smitheryExists) {
      try {
        const smitheryContent = readFileSync(smitheryPath, "utf-8");
        smitheryConfig = yaml.load(smitheryContent) as SmitheryConfig;
      } catch (yamlError) {
        console.warn(
          `Failed to parse smithery.yaml at ${smitheryPath}: ${
            yamlError instanceof Error ? yamlError.message : String(yamlError)
          }`
        );
      }
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

    if (smitheryConfig.commandFunction?.build) {
      buildCommand = smitheryConfig.commandFunction.build;
    } else {
      // Check for build script options in package.json if not in smithery.yaml
      if (scripts.build) {
        buildCommand = "npm run build";
      } else if (scripts.compile) {
        buildCommand = "npm run compile";
      } else if (scripts.prepublish) {
        buildCommand = "npm run prepublish";
      } else if (scripts.prepare) {
        buildCommand = "npm run prepare";
      }
    }

    if (smitheryConfig.commandFunction?.run) {
      runCommand = smitheryConfig.commandFunction.run;
    } else {
      // Determine run command based on available scripts in package.json if not in smithery.yaml
      if (scripts.start) {
        runCommand = "npm run start";
      } else if (scripts.dev) {
        runCommand = "npm run dev";
      } else if (scripts.serve) {
        runCommand = "npm run serve";
      } else {
        // If no obvious run script, check for bin entry
        if (packageJson.bin) {
          const binEntry =
            typeof packageJson.bin === "string"
              ? packageJson.bin
              : Object.values(packageJson.bin)[0];

          if (binEntry) {
            // If the package has a binary, run that directly
            // Ensure it's executed with node if it's a JS file, might need adjustment based on shebang or file type
            runCommand = binEntry.endsWith(".js")
              ? `node ${binEntry}`
              : binEntry;
          }
        }
      }
    }

    let buildSuccessful = false;

    // Install dependencies but skip the build step
    try {
      // Install dependencies but skip scripts to avoid build issues
      await Bun.$`cd ${packagePath} && npm install --ignore-scripts`.quiet();

      // Check if the package already has a dist/ or lib/ directory with compiled JS
      const hasDistDir = existsSync(join(packagePath, "dist"));
      const hasLibDir = existsSync(join(packagePath, "lib"));
      const hasOutDir = existsSync(join(packagePath, "out"));

      if (hasDistDir || hasLibDir || hasOutDir) {
        buildSuccessful = true;
      } else {
        // Check if we need to run a build
        const needsBuild = hasTsConfig || buildCommand;

        if (needsBuild) {
          // Let's first try the specified build command (from smithery or package.json)
          if (buildCommand) {
            try {
              // console.log(`Running build command: ${buildCommand}`);
              // Execute the command via sh
              await Bun.$`sh -c ${`cd ${packagePath} && ${buildCommand}`}`.quiet();
              buildSuccessful = true;
            } catch (buildError) {
              // console.warn(`Build failed: ${String(buildError)}`);
            }
          }

          // If build failed or there was no build command but we have TypeScript
          if (!buildSuccessful && hasTsConfig) {
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
                break;
              }
            }

            if (foundTsFile) {
              // Create dist directory if it doesn't exist
              const distDir = join(packagePath, "dist");
              if (!existsSync(distDir)) {
                mkdirSync(distDir, { recursive: true });
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

              // Add ts-node as a dependency
              try {
                await Bun.$`cd ${packagePath} && npm install --save-dev ts-node typescript @swc/core`.quiet();
                buildSuccessful = true;
              } catch (installError) {
                console.warn(
                  `Failed to install ts-node: ${String(installError)}`
                );
              }
            } else {
              console.warn(`Could not find TypeScript entry point`);
            }
          }
        } else {
          // If the package doesn't have TypeScript or a build command, just mark as successful
          buildSuccessful = true;
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

    // Determine the final run command, potentially overriding based on build output
    let finalRunCommand = runCommand;

    // If a build was successful and the run command seems to use a source runner
    const sourceRunners = ["ts-node", "tsx"];

    // Check if the run command executes a script that uses a source runner
    let runScriptContent = "";
    if (runCommand && runCommand.startsWith("npm run ")) {
      const scriptName = runCommand.substring(8);
      if (packageJson.scripts && packageJson.scripts[scriptName]) {
        runScriptContent = packageJson.scripts[scriptName];
      }
    }

    if (
      buildSuccessful &&
      runCommand &&
      runScriptContent &&
      sourceRunners.some((runner) => runScriptContent.includes(runner))
    ) {
      const buildOutputDirs = ["dist", "lib"];
      let foundBuiltEntry = null;

      // Try to infer the entry point from the *script content*
      const scriptArgs = runScriptContent.split(" ");
      let sourceEntryPoint = scriptArgs.find(
        (arg) => arg.endsWith(".ts") || arg.endsWith(".tsx")
      );

      if (sourceEntryPoint) {
        sourceEntryPoint = sourceEntryPoint.replace(/^\.\//, "");

        for (const dir of buildOutputDirs) {
          // Construct potential paths based on source entry point
          const jsEntryPoint = sourceEntryPoint.replace(/\.(ts|tsx)$/, ".js");
          const jsEntryPointNoSrc = sourceEntryPoint
            .replace(/^src\//, "")
            .replace(/\.(ts|tsx)$/, ".js");
          const jsIndexEntryPoint = join(
            dirname(sourceEntryPoint.replace(/^src\//, "")),
            "index.js"
          );

          const potentialBuiltPath = join(packagePath, dir, jsEntryPoint);
          if (existsSync(potentialBuiltPath)) {
            foundBuiltEntry = potentialBuiltPath;
            break;
          }

          const potentialBuiltPathNoSrc = join(
            packagePath,
            dir,
            jsEntryPointNoSrc
          );
          if (existsSync(potentialBuiltPathNoSrc)) {
            foundBuiltEntry = potentialBuiltPathNoSrc;
            break;
          }

          const potentialBuiltPathIndex = join(
            packagePath,
            dir,
            jsIndexEntryPoint
          );
          if (existsSync(potentialBuiltPathIndex)) {
            foundBuiltEntry = potentialBuiltPathIndex;
            break;
          }
        }
      } else {
        console.warn(
          `Could not infer source entry point from script: ${runScriptContent}`
        );
      }

      if (foundBuiltEntry) {
        // Construct the node command relative to the package path if possible,
        // otherwise use absolute path.
        const relativeBuiltPath = relative(packagePath, foundBuiltEntry);
        finalRunCommand = `node ${relativeBuiltPath}`;
      } else {
        console.warn(
          `Build successful, but couldn't find corresponding built file for source entry point: ${sourceEntryPoint}. Using original run command: ${runCommand}`
        );
      }
    }

    // Update configuration.json
    const configPath = join(basePath as string, ".furikake/configuration.json");
    const configExists = existsSync(configPath);
    let config: Record<string, any> = {};

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

      // Ensure installed property exists
      if (!config.installed) {
        config.installed = {};
      }

      // Add package to installed section
      config.installed[mcpName] = {
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
      message: `${mcpName} initialized`,
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
