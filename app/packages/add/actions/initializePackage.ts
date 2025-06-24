import { join, relative, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  getPackagePath,
  resolveFromBase,
  resolveFromUserData,
} from "@/helpers/paths";
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

// Create a transport wrapper that enables multiple connection methods
async function createTransportWrapper(
  packagePath: string,
  mcpName: string,
  originalRunCommand: string
): Promise<{ success: boolean; runCommand?: string }> {
  try {
    // Check if the package uses ESM
    const packageJsonPath = join(packagePath, "package.json");
    let isESM = false;

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        isESM = packageJson.type === "module";
      } catch (e) {
        // Default to CommonJS if we can't read package.json
      }
    }

    // Create a wrapper script that:
    // 1. Starts the original MCP server with stdio
    // 2. Creates a Unix socket for additional connections
    // 3. Properly handles TypeScript execution

    const wrapperPath = join(
      packagePath,
      isESM ? "furi-transport-wrapper.mjs" : "furi-transport-wrapper.cjs"
    );
    const socketPath = resolveFromUserData(
      `/transport/furi_${mcpName.replace("/", "-")}.sock`
    );

    // Ensure the transport directory exists
    const transportDir = dirname(socketPath);
    if (!existsSync(transportDir)) {
      mkdirSync(transportDir, { recursive: true });
    }

    // Parse the original command to handle TypeScript files properly
    const parts = originalRunCommand.split(" ");
    let executionCommand = originalRunCommand;

    // Check if the command tries to execute a .ts file directly
    const hasTypeScriptFile = parts.some(
      (part) => part.endsWith(".ts") || part.endsWith(".tsx")
    );

    if (hasTypeScriptFile) {
      // Check if ts-node or tsx is available
      const hasTsNode = existsSync(
        join(packagePath, "node_modules", ".bin", "ts-node")
      );
      const hasTsx = existsSync(
        join(packagePath, "node_modules", ".bin", "tsx")
      );

      if (hasTsx) {
        // Prefer tsx for better compatibility
        executionCommand = originalRunCommand.replace(/^node\s+/, "npx tsx ");
      } else if (hasTsNode) {
        // Use ts-node with proper ESM support
        if (isESM) {
          executionCommand = originalRunCommand.replace(
            /^node\s+/,
            "node --loader ts-node/esm "
          );
        } else {
          executionCommand = originalRunCommand.replace(
            /^node\s+/,
            "npx ts-node "
          );
        }
      } else {
        // Install tsx as fallback for TypeScript execution
        try {
          await Bun.$`cd ${packagePath} && npm install --save-dev tsx`.quiet();
          executionCommand = originalRunCommand.replace(/^node\s+/, "npx tsx ");
        } catch (installError) {
          console.warn(`Failed to install tsx: ${String(installError)}`);
          // Keep original command as fallback
        }
      }
    }

    // Generate appropriate wrapper based on module type
    const wrapperContent = isESM
      ? // ESM wrapper
        `#!/usr/bin/env node
/**
 * Furikake Transport Wrapper (ESM)
 * This wrapper enables multiple connection methods to the MCP server
 */

import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mcpName = '${mcpName}';
const socketPath = '${socketPath}';
const originalCommand = ${JSON.stringify(executionCommand)};

// Ensure the transport directory exists
const transportDir = path.dirname(socketPath);
if (!fs.existsSync(transportDir)) {
  fs.mkdirSync(transportDir, { recursive: true });
}

// Clean up any existing socket
if (fs.existsSync(socketPath)) {
  fs.unlinkSync(socketPath);
}

// Enhanced command parsing with shell execution
let mcpProcess;
try {
  // Use shell execution for better command handling
  mcpProcess = spawn('sh', ['-c', originalCommand], {
    cwd: __dirname, // Ensure we're in the package directory
    env: { ...process.env, NODE_OPTIONS: '--no-warnings' },
    stdio: 'pipe'
  });
} catch (spawnError) {
  console.error('[Furikake] Failed to spawn MCP process:', spawnError);
  throw spawnError;
}

// Forward stdio for PM2 compatibility
mcpProcess.stdout.on('data', (data) => process.stdout.write(data));
mcpProcess.stderr.on('data', (data) => process.stderr.write(data));
process.stdin.pipe(mcpProcess.stdin);

// Create Unix socket server for additional connections
const server = net.createServer((socket) => {
  // console.log('[Furikake] Client connected via Unix socket');

  // Handle socket errors gracefully
  socket.on('error', (err) => {
    // console.log('[Furikake] Socket error:', err.message);
    // Don't crash the server on individual socket errors
  });

  socket.on('close', () => {
    // console.log('[Furikake] Client disconnected from Unix socket');
  });

  // Create bidirectional pipe between socket and MCP process with error handling
  socket.pipe(mcpProcess.stdin, { end: false });
  mcpProcess.stdout.pipe(socket, { end: false });

  // Handle pipe errors
  mcpProcess.stdout.on('error', (err) => {
    // console.log('[Furikake] MCP stdout error:', err.message);
    try { socket.destroy(); } catch (e) { /* ignore */ }
  });

  mcpProcess.stdin.on('error', (err) => {
    // console.log('[Furikake] MCP stdin error:', err.message);
    try { socket.destroy(); } catch (e) { /* ignore */ }
  });
});

server.listen(socketPath, () => {
  // Set permissions so other processes can connect
  fs.chmodSync(socketPath, '666');
});

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
mcpProcess.on('exit', (code) => {
  // console.log('[Furikake] MCP process exited with code:', code);
  cleanup();
  process.exit(code || 0);
});

function cleanup() {
  // console.log('[Furikake] Cleaning up...');
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }
  if (mcpProcess && !mcpProcess.killed) {
    mcpProcess.kill();
  }
}
`
      : // CommonJS wrapper
        `#!/usr/bin/env node
/**
 * Furikake Transport Wrapper (CommonJS)
 * This wrapper enables multiple connection methods to the MCP server
 */

const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

const mcpName = '${mcpName}';
const socketPath = '${socketPath}';
const originalCommand = ${JSON.stringify(executionCommand)};

// Ensure the transport directory exists
const transportDir = path.dirname(socketPath);
if (!fs.existsSync(transportDir)) {
  fs.mkdirSync(transportDir, { recursive: true });
}

// Clean up any existing socket
if (fs.existsSync(socketPath)) {
  fs.unlinkSync(socketPath);
}

// Enhanced command parsing with shell execution
let mcpProcess;
try {
  // Use shell execution for better command handling
  mcpProcess = spawn('sh', ['-c', originalCommand], {
    cwd: __dirname, // Ensure we're in the package directory
    env: { ...process.env, NODE_OPTIONS: '--no-warnings' },
    stdio: 'pipe'
  });
} catch (spawnError) {
  console.error('[Furikake] Failed to spawn MCP process:', spawnError);
  throw spawnError;
}

// Forward stdio for PM2 compatibility
mcpProcess.stdout.on('data', (data) => process.stdout.write(data));
mcpProcess.stderr.on('data', (data) => process.stderr.write(data));
process.stdin.pipe(mcpProcess.stdin);

// Create Unix socket server for additional connections
const server = net.createServer((socket) => {
  // console.log('[Furikake] Client connected via Unix socket');

  // Handle socket errors gracefully
  socket.on('error', (err) => {
    // console.log('[Furikake] Socket error:', err.message);
    // Don't crash the server on individual socket errors
  });

  socket.on('close', () => {
    // console.log('[Furikake] Client disconnected from Unix socket');
  });

  // Create bidirectional pipe between socket and MCP process with error handling
  socket.pipe(mcpProcess.stdin, { end: false });
  mcpProcess.stdout.pipe(socket, { end: false });

  // Handle pipe errors
  mcpProcess.stdout.on('error', (err) => {
    // console.log('[Furikake] MCP stdout error:', err.message);
    try { socket.destroy(); } catch (e) { /* ignore */ }
  });

  mcpProcess.stdin.on('error', (err) => {
    // console.log('[Furikake] MCP stdin error:', err.message);
    try { socket.destroy(); } catch (e) { /* ignore */ }
  });
});

server.listen(socketPath, () => {
  // Set permissions so other processes can connect
  fs.chmodSync(socketPath, '666');
});

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
mcpProcess.on('exit', (code) => {
  // console.log('[Furikake] MCP process exited with code:', code);
  cleanup();
  process.exit(code || 0);
});

function cleanup() {
  // console.log('[Furikake] Cleaning up...');
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }
  if (mcpProcess && !mcpProcess.killed) {
    mcpProcess.kill();
  }
}
`;

    // Write the wrapper file
    writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });

    // Return the new run command
    return {
      success: true,
      runCommand: `node ${relative(packagePath, wrapperPath)}`,
    };
  } catch (error) {
    console.warn(
      `Failed to create transport wrapper: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return { success: false };
  }
}

// The goal of this function is to initialize the package
// Get it to the point where it can be used by the user
export const initializePackage = async (
  mcpName: string
): Promise<PackageOutput> => {
  try {
    // Get the package path
    const parts = mcpName.split("/");
    const [author, repo] = parts;

    if (parts.length !== 2 || !author || !repo) {
      return {
        success: false,
        message: "Invalid MCP Name format. Expected 'user/repo'",
      };
    }

    const packagePath = getPackagePath(author, repo);
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
            // Handle different file types appropriately
            if (binEntry.endsWith(".js")) {
              runCommand = `node ${binEntry}`;
            } else if (binEntry.endsWith(".ts") || binEntry.endsWith(".tsx")) {
              // Use tsx for TypeScript files instead of node directly
              runCommand = `npx tsx ${binEntry}`;
            } else {
              // For other files, execute directly (assuming they have proper shebang)
              runCommand = binEntry;
            }
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
                // ESM wrapper using tsx for better compatibility
                const esmWrapper = `
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// TypeScript file path
const srcPath = join(__dirname, '${foundTsFile.relativePath}');

// Use tsx to execute TypeScript file
const child = spawn('npx', ['tsx', srcPath], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
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
                // CommonJS wrapper using tsx for better compatibility
                const cjsWrapper = `
// This is an automatically generated CommonJS wrapper for TypeScript files
const { spawn } = require('child_process');
const path = require('path');

// TypeScript file path
const srcPath = path.join(__dirname, '${foundTsFile.relativePath}');

// Use tsx to execute TypeScript file
const child = spawn('npx', ['tsx', srcPath], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
`;
                writeFileSync(join(distDir, "index.js"), cjsWrapper, "utf-8");
              }

              // Add tsx as a dependency instead of ts-node for better compatibility
              try {
                await Bun.$`cd ${packagePath} && npm install --save-dev tsx typescript`.quiet();
                buildSuccessful = true;
              } catch (installError) {
                console.warn(`Failed to install tsx: ${String(installError)}`);
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

    // Safety check: ensure no TypeScript files are executed directly with node
    if (
      finalRunCommand &&
      finalRunCommand.includes("node ") &&
      (finalRunCommand.includes(".ts") || finalRunCommand.includes(".tsx"))
    ) {
      // Replace node with tsx for TypeScript files
      finalRunCommand = finalRunCommand.replace(/^node\s+/, "npx tsx ");
    }

    // If no run command was found and we have TypeScript files, create a default one
    if (!finalRunCommand && hasTsConfig) {
      // Check for TypeScript entry points
      const potentialEntries = [
        "src/index.ts",
        "index.ts",
        "src/main.ts",
        "main.ts",
      ];

      for (const entry of potentialEntries) {
        if (existsSync(join(packagePath, entry))) {
          finalRunCommand = `npx tsx ${entry}`;
          break;
        }
      }
    }

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
    const configPath = resolveFromUserData("configuration.json");
    const configExists = existsSync(configPath);
    let config: Record<string, any> = {};
    let configReadError = false;
    let actualRunCommand = finalRunCommand; // Declare here with default value

    try {
      if (configExists) {
        try {
          const configContent = readFileSync(configPath, "utf-8");
          if (configContent.trim()) {
            config = JSON.parse(configContent);
          }
        } catch (parseError) {
          configReadError = true;
          // config remains {}
        }
      }

      if (!config.installed) {
        config.installed = {};
      }

      // Debug: Log the final run command
      // console.log(
      //   `[${mcpName}] Final run command before wrapper: ${finalRunCommand}`
      // );

      // Create transport wrapper for the MCP server
      const wrapperCreated = await createTransportWrapper(
        packagePath,
        mcpName,
        finalRunCommand
      );

      // Use wrapper command if successfully created
      actualRunCommand = wrapperCreated.success
        ? wrapperCreated.runCommand!
        : finalRunCommand;

      const socketPath = resolveFromUserData(
        `/transport/furi_${mcpName.replace("/", "-")}.sock`
      );

      config.installed[mcpName] = {
        run: actualRunCommand,
        source: packagePath,
        socketPath: socketPath,
        originalRun: finalRunCommand,
        transportWrapper: wrapperCreated.success ? true : false,
      };

      try {
        writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
        // console.log(
        //   `[${mcpName}] initializePackage: Successfully wrote to ${configPath}`
        // ); // Debug log
      } catch (writeError) {
        // console.error(
        //   `[${mcpName}] initializePackage: CRITICAL - Failed to write configuration to ${configPath}. Error: ${
        //     writeError instanceof Error
        //       ? writeError.message
        //       : String(writeError)
        //   }`
        // );
        return {
          success: false,
          message: `CRITICAL: Failed to write configuration for ${mcpName}. Error: ${
            writeError instanceof Error
              ? writeError.message
              : String(writeError)
          }`,
        };
      }

      if (configReadError) {
        // If there was a read error but write succeeded, it's a partial success.
        // The original message about initialization should probably still be primary.
        // console.warn(
        //   `[${mcpName}] initializePackage: Configuration file was corrupt but has been successfully overwritten.`
        // );
      }
    } catch (error) {
      // This outer catch is for any unexpected error in the config update block itself, not fs operations.
      // console.error(
      //   `[${mcpName}] initializePackage: Unexpected error during configuration update logic. Error: ${
      //     error instanceof Error ? error.message : String(error)
      //   }`
      // );
      return {
        success: false,
        message: `Unexpected error during configuration update for ${mcpName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    return {
      success: true,
      message: `${mcpName} initialized`,
      runCommand: actualRunCommand,
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
