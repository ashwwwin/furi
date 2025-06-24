import { readFileSync, writeFileSync } from "fs";
import pm2 from "pm2";
import {
  resolveFromBase,
  getPackagePath,
  resolveFromUserData,
} from "@/helpers/paths";
import { isAbsolute } from "path";

// Connect to PM2
const connectToPm2 = async (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(new Error(`Failed to connect to PM2: ${err.message}`));
        return;
      }
      resolve();
    });
  });
};

// Get PM2 process list
const getPm2List = async (): Promise<any[]> => {
  return new Promise<any[]>((resolve, reject) => {
    pm2.list((err, list) => {
      if (err) {
        reject(new Error(`Failed to get process list: ${err.message}`));
        return;
      }
      resolve(list);
    });
  });
};

export const renamePackage = async (
  currentName: string,
  newName: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Read the configuration.json file
    const configPath = resolveFromUserData("configuration.json");
    let config;

    try {
      const configContent = readFileSync(configPath, "utf-8");
      config = JSON.parse(configContent);
    } catch (error) {
      return {
        success: false,
        message: `Failed to read configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    // Check if the current name exists in root or installed
    const currentConfigLocation = config[currentName]
      ? "root"
      : config.installed && config.installed[currentName]
      ? "installed"
      : null;

    if (!currentConfigLocation) {
      return {
        success: false,
        message: `${currentName} not found in configuration.\nTo view all installed repos, use: furi list`,
      };
    }

    // Check if the new name already exists in root or installed
    if (config[newName] || (config.installed && config.installed[newName])) {
      return {
        success: false,
        message: `${newName} already exists in configuration`,
      };
    }

    // Check if there's a running PM2 process for the current name
    const currentProcessName = `furi_${currentName.replace("/", "-")}`;
    const newProcessName = `furi_${newName.replace("/", "-")}`;
    let isProcessRunning = false;
    let pmWarning = "";

    try {
      // Connect to PM2
      await connectToPm2();

      // Get list of running processes
      const processList = await getPm2List();

      // Find if the current process is running
      const processEntry = processList.find(
        (p) => p.name === currentProcessName
      );

      if (processEntry && processEntry.pm2_env.status === "online") {
        isProcessRunning = true;

        // Stop the current process
        await new Promise<void>((resolve, reject) => {
          pm2.delete(currentProcessName, (err) => {
            if (err) {
              reject(new Error(`Failed to stop process: ${err.message}`));
              return;
            }
            resolve();
          });
        });
      }
    } catch (pmError) {
      pmWarning = `Failed to manage PM2 process: ${
        pmError instanceof Error ? pmError.message : String(pmError)
      }`;
    } finally {
      // Always disconnect from PM2
      pm2.disconnect();
    }

    // Get the actual config object for the current name
    const currentMcpConfig =
      currentConfigLocation === "root"
        ? config[currentName]
        : config.installed[currentName];

    // Create new entry with same config but different key in the appropriate location
    if (currentConfigLocation === "root") {
      config[newName] = { ...currentMcpConfig };
      delete config[currentName];
    } else {
      if (!config.installed) config.installed = {}; // Should exist, but safety check
      config.installed[newName] = { ...currentMcpConfig };
      delete config.installed[currentName];
    }

    // Write the updated configuration back to file
    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      let finalMessage = `Renamed from ${currentName} to ${newName}`;

      if (pmWarning) {
        finalMessage += `\nWarning: ${pmWarning}`;
      }

      // If process was running, restart it with the new name
      if (isProcessRunning) {
        try {
          // Get the process configuration from the new location
          const newMcpConfig =
            currentConfigLocation === "root"
              ? config[newName]
              : config.installed[newName];

          const runCommand = newMcpConfig.run || "npm run start";
          const [cmd, ...args] = runCommand.split(" ");

          let cwd: string;
          if (newMcpConfig.source) {
            cwd = newMcpConfig.source; // Should be absolute
            if (!isAbsolute(cwd)) {
              console.warn(
                `[${newName}] newMcpConfig.source in rename was not absolute. Resolving from base. Source: ${cwd}`
              );
              cwd = resolveFromUserData(cwd);
            }
          } else {
            console.warn(
              `[${newName}] newMcpConfig.source is not defined in rename. Falling back to default installed path structure.`
            );
            const parts = newName.split("/");
            const owner = parts[0];
            const repo = parts[1];
            if (owner && repo) {
              cwd = getPackagePath(owner, repo);
            } else {
              cwd = resolveFromUserData("installed", newName);
            }
          }

          // Prepare environment variables
          const env: Record<string, string> = {};
          if (process.env.PATH) env.PATH = process.env.PATH;
          if (process.env.NODE_ENV) env.NODE_ENV = process.env.NODE_ENV;
          if (process.env.HOME) env.HOME = process.env.HOME;
          if (process.env.USER) env.USER = process.env.USER;

          // Add package-specific environment variables
          if (newMcpConfig?.env) {
            for (const [key, value] of Object.entries(newMcpConfig.env)) {
              if (value !== undefined && value !== null) {
                env[key] = String(value);
              }
            }
          }

          // Connect to PM2
          await connectToPm2();

          // Start the process with the new name
          await new Promise<void>((resolve, reject) => {
            pm2.start(
              {
                script: cmd,
                args: args.join(" "),
                name: newProcessName,
                cwd,
                interpreter_args: cmd === "npm" ? [] : undefined,
                env: env,
                merge_logs: true,
                log_date_format: "YYYY-MM-DD HH:mm:ss Z",
              },
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve();
              }
            );
          });

          finalMessage += `\nProcess restarted with new name ${newName}`;
        } catch (startError) {
          return {
            success: false,
            message: `Failed to restart process: ${
              startError instanceof Error
                ? startError.message
                : String(startError)
            }`,
          };
        } finally {
          // Always disconnect from PM2
          pm2.disconnect();
        }
      }

      return {
        success: true,
        message: finalMessage,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error renaming: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};
