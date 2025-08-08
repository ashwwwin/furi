import { join, relative, dirname } from "path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
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

// Helper function to detect Python package type
function detectPythonPackageType(packagePath: string): {
  isPython: boolean;
  hasRequirements: boolean;
  hasSetupPy: boolean;
  hasPyprojectToml: boolean;
  hasPoetryLock: boolean;
  hasPipfile: boolean;
  mainModule?: string;
} {
  const requirements = existsSync(join(packagePath, "requirements.txt"));
  const setupPy = existsSync(join(packagePath, "setup.py"));
  const pyprojectToml = existsSync(join(packagePath, "pyproject.toml"));
  const poetryLock = existsSync(join(packagePath, "poetry.lock"));
  const pipfile = existsSync(join(packagePath, "Pipfile"));

  // Check for common Python entry points
  const possibleMainModules = [
    "main.py",
    "app.py",
    "server.py",
    "mcp_server.py",
    "__main__.py",
    "src/main.py",
    "src/app.py",
    "src/server.py",
  ];

  let mainModule: string | undefined;
  for (const module of possibleMainModules) {
    if (existsSync(join(packagePath, module))) {
      mainModule = module;
      break;
    }
  }

  const isPython = requirements || setupPy || pyprojectToml || poetryLock || pipfile || mainModule !== undefined;

  return {
    isPython,
    hasRequirements: requirements,
    hasSetupPy: setupPy,
    hasPyprojectToml: pyprojectToml,
    hasPoetryLock: poetryLock,
    hasPipfile: pipfile,
    mainModule,
  };
}

// Helper function to get Python executable path
async function getPythonExecutable(): Promise<string> {
  // Try different Python executables in order of preference
  const pythonCommands = ["python3", "python", "python3.11", "python3.10", "python3.9", "python3.8"];

  for (const cmd of pythonCommands) {
    try {
      const result = await Bun.$`which ${cmd}`.quiet();
      if (result.exitCode === 0) {
        return cmd;
      }
    } catch (error) {
      continue;
    }
  }

  // Default fallback
  return "python3";
}

// Helper function to create Python virtual environment and install dependencies
async function setupPythonEnvironment(packagePath: string, packageInfo: ReturnType<typeof detectPythonPackageType>): Promise<{
  success: boolean;
  venvPath?: string;
  pythonPath?: string;
  error?: string;
}> {
  try {
    const venvPath = join(packagePath, ".venv");
    const pythonExec = await getPythonExecutable();

    // Create virtual environment
    try {
      await Bun.$`cd ${packagePath} && ${pythonExec} -m venv .venv`.quiet();
    } catch (venvError) {
      return {
        success: false,
        error: `Failed to create virtual environment: ${String(venvError)}`,
      };
    }

    // Determine the Python executable path in the virtual environment
    const isWindows = process.platform === "win32";
    const pythonPath = isWindows
      ? join(venvPath, "Scripts", "python.exe")
      : join(venvPath, "bin", "python");

    // Upgrade pip first
    try {
      await Bun.$`cd ${packagePath} && ${pythonPath} -m pip install --upgrade pip`.quiet();
    } catch (pipUpgradeError) {
      console.warn(`Failed to upgrade pip: ${String(pipUpgradeError)}`);
    }

    // Install dependencies based on package type
    if (packageInfo.hasRequirements) {
      try {
        await Bun.$`cd ${packagePath} && ${pythonPath} -m pip install -r requirements.txt`.quiet();
      } catch (requirementsError) {
        return {
          success: false,
          error: `Failed to install requirements.txt: ${String(requirementsError)}`,
        };
      }
    } else if (packageInfo.hasSetupPy) {
      try {
        await Bun.$`cd ${packagePath} && ${pythonPath} -m pip install -e .`.quiet();
      } catch (setupError) {
        return {
          success: false,
          error: `Failed to install with setup.py: ${String(setupError)}`,
        };
      }
    } else if (packageInfo.hasPyprojectToml) {
      try {
        await Bun.$`cd ${packagePath} && ${pythonPath} -m pip install -e .`.quiet();
      } catch (pyprojectError) {
        return {
          success: false,
          error: `Failed to install with pyproject.toml: ${String(pyprojectError)}`,
        };
      }
    } else if (packageInfo.hasPoetryLock) {
      // Check if poetry is available
      try {
        await Bun.$`which poetry`.quiet();
        await Bun.$`cd ${packagePath} && poetry install`.quiet();
      } catch (poetryError) {
        return {
          success: false,
          error: `Poetry not found or failed to install dependencies: ${String(poetryError)}`,
        };
      }
    } else if (packageInfo.hasPipfile) {
      // Check if pipenv is available
      try {
        await Bun.$`which pipenv`.quiet();
        await Bun.$`cd ${packagePath} && pipenv install`.quiet();
      } catch (pipenvError) {
        return {
          success: false,
          error: `Pipenv not found or failed to install dependencies: ${String(pipenvError)}`,
        };
      }
    }

    // Install common MCP dependencies if not already present
    try {
      await Bun.$`cd ${packagePath} && ${pythonPath} -m pip install mcp`.quiet();
    } catch (mcpInstallError) {
      console.warn(`Failed to install mcp package: ${String(mcpInstallError)}`);
    }

    return {
      success: true,
      venvPath,
      pythonPath,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to setup Python environment: ${String(error)}`,
    };
  }
}

// Create a transport wrapper for Python MCP servers
async function createPythonTransportWrapper(
  packagePath: string,
  mcpName: string,
  originalRunCommand: string,
  pythonPath: string
): Promise<{ success: boolean; runCommand?: string }> {
  try {
    const wrapperPath = join(packagePath, "furi-transport-wrapper.py");
    const socketPath = resolveFromUserData(
      `/transport/furi_${mcpName.replace("/", "-")}.sock`
    );

    // Ensure the transport directory exists
    const transportDir = dirname(socketPath);
    if (!existsSync(transportDir)) {
      mkdirSync(transportDir, { recursive: true });
    }

    // Clean up any existing socket
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }

    const wrapperContent = `#!/usr/bin/env python3
"""
Furikake Transport Wrapper for Python MCP Servers
This wrapper enables multiple connection methods to the MCP server
"""

import subprocess
import socket
import os
import sys
import threading
import signal
import atexit
from pathlib import Path

MCP_NAME = "${mcpName}"
SOCKET_PATH = "${socketPath}"
ORIGINAL_COMMAND = "${originalRunCommand}"

def cleanup():
    """Clean up socket file on exit"""
    try:
        if os.path.exists(SOCKET_PATH):
            os.unlink(SOCKET_PATH)
    except Exception:
        pass

def signal_handler(signum, frame):
    """Handle termination signals"""
    cleanup()
    sys.exit(0)

def main():
    # Ensure transport directory exists
    transport_dir = os.path.dirname(SOCKET_PATH)
    os.makedirs(transport_dir, exist_ok=True)

    # Clean up any existing socket
    cleanup()

    # Register cleanup function
    atexit.register(cleanup)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start the MCP server process
    try:
        # Parse the command properly
        cmd_parts = ORIGINAL_COMMAND.split()
        if cmd_parts[0] == "python" or cmd_parts[0] == "python3":
            cmd_parts[0] = "${pythonPath}"

        mcp_process = subprocess.Popen(
            cmd_parts,
            cwd=os.path.dirname(__file__),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={**os.environ, "NODE_OPTIONS": "--no-warnings"}
        )
    except Exception as e:
        print(f"[Furikake] Failed to spawn MCP process: {e}", file=sys.stderr)
        sys.exit(1)

    # Forward stdio for PM2 compatibility
    def forward_output():
        while True:
            data = mcp_process.stdout.read(1024)
            if not data:
                break
            sys.stdout.buffer.write(data)
            sys.stdout.buffer.flush()

    def forward_error():
        while True:
            data = mcp_process.stderr.read(1024)
            if not data:
                break
            sys.stderr.buffer.write(data)
            sys.stderr.buffer.flush()

    # Start forwarding threads
    stdout_thread = threading.Thread(target=forward_output, daemon=True)
    stderr_thread = threading.Thread(target=forward_error, daemon=True)
    stdout_thread.start()
    stderr_thread.start()

    # Forward stdin
    def forward_stdin():
        while True:
            try:
                data = sys.stdin.buffer.read(1024)
                if not data:
                    break
                mcp_process.stdin.write(data)
                mcp_process.stdin.flush()
            except Exception:
                break

    stdin_thread = threading.Thread(target=forward_stdin, daemon=True)
    stdin_thread.start()

    # Create Unix socket server for additional connections
    def handle_socket_client(client_socket):
        try:
            # Create bidirectional communication with MCP process
            def client_to_mcp():
                while True:
                    try:
                        data = client_socket.recv(1024)
                        if not data:
                            break
                        mcp_process.stdin.write(data)
                        mcp_process.stdin.flush()
                    except Exception:
                        break

            def mcp_to_client():
                while True:
                    try:
                        data = mcp_process.stdout.read(1024)
                        if not data:
                            break
                        client_socket.send(data)
                    except Exception:
                        break

            # Start communication threads
            t1 = threading.Thread(target=client_to_mcp, daemon=True)
            t2 = threading.Thread(target=mcp_to_client, daemon=True)
            t1.start()
            t2.start()

            # Wait for threads to complete
            t1.join()
            t2.join()

        except Exception as e:
            print(f"[Furikake] Socket client error: {e}", file=sys.stderr)
        finally:
            try:
                client_socket.close()
            except Exception:
                pass

    def socket_server():
        try:
            server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            server.bind(SOCKET_PATH)
            os.chmod(SOCKET_PATH, 0o666)
            server.listen(5)

            while True:
                client_socket, _ = server.accept()
                client_thread = threading.Thread(
                    target=handle_socket_client,
                    args=(client_socket,),
                    daemon=True
                )
                client_thread.start()

        except Exception as e:
            print(f"[Furikake] Socket server error: {e}", file=sys.stderr)

    # Start socket server in background
    socket_thread = threading.Thread(target=socket_server, daemon=True)
    socket_thread.start()

    # Wait for MCP process to complete
    try:
        mcp_process.wait()
    except KeyboardInterrupt:
        mcp_process.terminate()
        mcp_process.wait()
    finally:
        cleanup()
        sys.exit(mcp_process.returncode or 0)

if __name__ == "__main__":
    main()
`;

    // Write the wrapper file
    writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });

    // Return the new run command
    return {
      success: true,
      runCommand: `${pythonPath} ${relative(packagePath, wrapperPath)}`,
    };
  } catch (error) {
    console.warn(
      `Failed to create Python transport wrapper: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return { success: false };
  }
}

// Create a transport wrapper that enables multiple connection methods for Node.js/TypeScript
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

    // Clean up any existing socket
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
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

// Get the command from arguments passed by PM2 or use the fallback
const wrapperArgs = process.argv.slice(2);
const originalCommand = wrapperArgs.length > 0 
  ? wrapperArgs.join(' ') 
  : ${JSON.stringify(executionCommand)};

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

// Handle MCP process stream errors once
mcpProcess.stdout.on('error', (err) => {
  // console.log('[Furikake] MCP stdout error:', err.message);
});

mcpProcess.stdin.on('error', (err) => {
  // console.log('[Furikake] MCP stdin error:', err.message);
});

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

  // Create bidirectional pipe between socket and MCP process
  socket.pipe(mcpProcess.stdin, { end: false });
  mcpProcess.stdout.pipe(socket, { end: false });
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

// Get the command from arguments passed by PM2 or use the fallback
const wrapperArgs = process.argv.slice(2);
const originalCommand = wrapperArgs.length > 0 
  ? wrapperArgs.join(' ') 
  : ${JSON.stringify(executionCommand)};

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

// Handle MCP process stream errors once
mcpProcess.stdout.on('error', (err) => {
  // console.log('[Furikake] MCP stdout error:', err.message);
});

mcpProcess.stdin.on('error', (err) => {
  // console.log('[Furikake] MCP stdin error:', err.message);
});

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

  // Create bidirectional pipe between socket and MCP process
  socket.pipe(mcpProcess.stdin, { end: false });
  mcpProcess.stdout.pipe(socket, { end: false });
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

// Helper function to extract detailed error information from shell errors
function getShellErrorDetails(error: any): string {
  const errorDetails: string[] = [];

  if (error.exitCode !== undefined) {
    errorDetails.push(`Exit code: ${error.exitCode}`);
  }

  if (error.stderr) {
    const stderrText = error.stderr.toString().trim();
    if (stderrText) {
      errorDetails.push(`Error output:\n${stderrText}`);
    }
  }

  if (error.stdout) {
    const stdoutText = error.stdout.toString().trim();
    if (stdoutText && !errorDetails.some((d) => d.includes("Error output:"))) {
      errorDetails.push(`Command output:\n${stdoutText}`);
    }
  }

  if (errorDetails.length > 0) {
    return errorDetails.join("\n");
  }

  return error instanceof Error ? error.message : String(error);
}

// Helper function to add suggestions based on error type
function addErrorSuggestions(errorText: string): string {
  const lowerError = errorText.toLowerCase();
  let suggestions = "";

  if (lowerError.includes("eresolve") || lowerError.includes("peer dep")) {
    suggestions = "\n\nSuggestions:\n";
    suggestions += "• Try running: npm install --legacy-peer-deps\n";
    suggestions +=
      "• Or manually install in the package directory with --force flag";
  } else if (
    lowerError.includes("eacces") ||
    lowerError.includes("permission")
  ) {
    suggestions = "\n\nThis appears to be a permissions issue. Try:\n";
    suggestions += "• Running with sudo (not recommended)\n";
    suggestions +=
      "• Fixing npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors";
  } else if (
    lowerError.includes("enotfound") ||
    lowerError.includes("getaddrinfo")
  ) {
    suggestions = "\n\nThis appears to be a network issue. Check:\n";
    suggestions += "• Your internet connection\n";
    suggestions += "• Proxy/firewall settings\n";
    suggestions += "• npm registry configuration";
  }

  return suggestions;
}

// Initialize Python MCP package
async function initializePythonPackage(
  mcpName: string,
  packagePath: string,
  pythonInfo: ReturnType<typeof detectPythonPackageType>,
  smitheryConfig: SmitheryConfig
): Promise<PackageOutput> {
  try {
    // Setup Python virtual environment and install dependencies
    const pythonSetup = await setupPythonEnvironment(packagePath, pythonInfo);
    
    if (!pythonSetup.success) {
      return {
        success: false,
        message: pythonSetup.error || "Failed to setup Python environment",
      };
    }

    // Determine run command based on smithery.yaml or auto-detect
    let runCommand = "";
    
    if (smitheryConfig.commandFunction?.run) {
      runCommand = smitheryConfig.commandFunction.run;
    } else if (pythonInfo.mainModule) {
      // Use the detected main module
      runCommand = `python ${pythonInfo.mainModule}`;
    } else {
      // Try common patterns
      const commonEntryPoints = [
        "main.py",
        "app.py",
        "server.py",
        "mcp_server.py",
        "__main__.py"
      ];
      
      for (const entryPoint of commonEntryPoints) {
        if (existsSync(join(packagePath, entryPoint))) {
          runCommand = `python ${entryPoint}`;
          break;
        }
      }
    }

    if (!runCommand) {
      return {
        success: false,
        message: "Could not determine Python entry point. Please specify run command in smithery.yaml",
      };
    }

    // Create transport wrapper for Python MCP server
    const wrapperCreated = await createPythonTransportWrapper(
      packagePath,
      mcpName,
      runCommand,
      pythonSetup.pythonPath!
    );

    // Use wrapper command if successfully created
    const actualRunCommand = wrapperCreated.success
      ? wrapperCreated.runCommand!
      : `${pythonSetup.pythonPath} ${runCommand.replace(/^python\s+/, "")}`;

    // Update configuration.json
    const configPath = resolveFromUserData("configuration.json");
    const configExists = existsSync(configPath);
    let config: Record<string, any> = {};

    try {
      if (configExists) {
        try {
          const configContent = readFileSync(configPath, "utf-8");
          if (configContent.trim()) {
            config = JSON.parse(configContent);
          }
        } catch (parseError) {
          // config remains {}
        }
      }

      if (!config.installed) {
        config.installed = {};
      }

      const socketPath = resolveFromUserData(
        `/transport/furi_${mcpName.replace("/", "-")}.sock`
      );

      config.installed[mcpName] = {
        run: actualRunCommand,
        source: packagePath,
        socketPath: socketPath,
        originalRun: runCommand,
        transportWrapper: wrapperCreated.success,
        packageType: "python",
        pythonPath: pythonSetup.pythonPath,
        venvPath: pythonSetup.venvPath,
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
      message: `${mcpName} (Python) initialized`,
      runCommand: actualRunCommand,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to initialize Python package: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

// The goal of this function is to initialize the package
// Get it to the point where it can be used by the user
export const initializePackage = async (
  mcpName: string,
  spinner?: any
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

    // Detect package type - Python or Node.js
    const pythonInfo = detectPythonPackageType(packagePath);
    const packageJsonPath = join(packagePath, "package.json");
    const packageJsonExists = existsSync(packageJsonPath);

    // Handle package type selection
    if (pythonInfo.isPython && packageJsonExists) {
      // Both Python and Node.js files detected - prioritize Node.js if package.json exists
      console.log(`[${mcpName}] Both Python and Node.js files detected. Prioritizing Node.js (package.json found).`);
    } else if (pythonInfo.isPython && !packageJsonExists) {
      // Pure Python package
      return await initializePythonPackage(mcpName, packagePath, pythonInfo, smitheryConfig);
    } else if (!packageJsonExists && !pythonInfo.isPython) {
      return {
        success: false,
        message: "Not a supported package: No package.json (Node.js) or Python files found",
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
              const errorDetails = getShellErrorDetails(buildError);
              throw new Error(
                `Build command '${buildCommand}' failed:\n${errorDetails}`
              );
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
              } catch (installError: any) {
                console.warn(`Failed to install tsx: ${String(installError)}`);
                // Capture detailed error information for tsx install failure
                if (installError.stderr) {
                  const stderrText = installError.stderr.toString().trim();
                  if (stderrText) {
                    console.warn(`Install error details: ${stderrText}`);
                  }
                }
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
      const errorDetails = getShellErrorDetails(error);

      // Check if it's a peer dependency conflict that can be resolved with --legacy-peer-deps
      if (
        errorDetails.includes("this command with --force or --legacy-peer-deps")
      ) {
        // Update spinner message if available
        if (spinner) {
          spinner.update(`[${mcpName}] Installing with peer dependencies`);
        }

        try {
          // Retry with legacy peer deps flag
          await Bun.$`cd ${packagePath} && npm install --ignore-scripts --legacy-peer-deps`.quiet();

          // If successful, continue with the build process
          const hasDistDir = existsSync(join(packagePath, "dist"));
          const hasLibDir = existsSync(join(packagePath, "lib"));
          const hasOutDir = existsSync(join(packagePath, "out"));

          if (hasDistDir || hasLibDir || hasOutDir) {
            buildSuccessful = true;
          } else {
            // Continue with build process if needed
            const needsBuild = hasTsConfig || buildCommand;

            if (needsBuild) {
              if (buildCommand) {
                try {
                  await Bun.$`sh -c ${`cd ${packagePath} && ${buildCommand}`}`.quiet();
                  buildSuccessful = true;
                } catch (buildError) {
                  const buildErrorDetails = getShellErrorDetails(buildError);
                  throw new Error(
                    `Build command '${buildCommand}' failed:\n${buildErrorDetails}`
                  );
                }
              }

              // Handle TypeScript files if build failed or no build command
              if (!buildSuccessful && hasTsConfig) {
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
                  const distDir = join(packagePath, "dist");
                  if (!existsSync(distDir)) {
                    mkdirSync(distDir, { recursive: true });
                  }

                  const wrapperContent = isEsm
                    ? `
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcPath = join(__dirname, '${foundTsFile.relativePath}');

const child = spawn('npx', ['tsx', srcPath], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('exit', (code) => process.exit(code || 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
`
                    : `
const { spawn } = require('child_process');
const path = require('path');

const srcPath = path.join(__dirname, '${foundTsFile.relativePath}');

const child = spawn('npx', ['tsx', srcPath], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('exit', (code) => process.exit(code || 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
`;

                  writeFileSync(
                    join(distDir, "index.js"),
                    wrapperContent,
                    "utf-8"
                  );

                  if (isEsm) {
                    writeFileSync(
                      join(distDir, "package.json"),
                      JSON.stringify({ type: "module" }, null, 2),
                      "utf-8"
                    );
                  }

                  try {
                    await Bun.$`cd ${packagePath} && npm install --save-dev tsx typescript --legacy-peer-deps`.quiet();
                    buildSuccessful = true;
                  } catch (installError: any) {
                    console.warn(
                      `Failed to install tsx: ${String(installError)}`
                    );
                  }
                }
              }
            } else {
              buildSuccessful = true;
            }
          }
        } catch (retryError) {
          const retryErrorDetails = getShellErrorDetails(retryError);
          return {
            success: false,
            message: `Failed to install dependencies (even with --legacy-peer-deps):\n${retryErrorDetails}`,
          };
        }
      } else {
        // For other errors, show detailed error with suggestions
        const suggestions = addErrorSuggestions(errorDetails);
        return {
          success: false,
          message: `Failed to install dependencies:\n${errorDetails}${suggestions}`,
        };
      }
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
        packageType: "nodejs",
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
