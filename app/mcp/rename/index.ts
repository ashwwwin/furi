import { createSpinner } from "nanospinner";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import pm2 from "pm2";

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

export const renameMCP = async (currentName: string, newName: string) => {
  const spinner = createSpinner(
    `Renaming from \x1b[2m${currentName}\x1b[0m to \x1b[2m${newName}\x1b[0m`
  );

  if (newName === "all") {
    spinner.error("Cannot use \x1b[2mall\x1b[0m as a new name");
    return;
  }

  spinner.start();

  try {
    const basePath = process.env.BASE_PATH || "";
    if (!basePath) {
      throw new Error("BASE_PATH environment variable is not set");
    }

    // Read the configuration.json file
    const configPath = join(basePath, ".furikake/configuration.json");
    let config;

    try {
      const configContent = readFileSync(configPath, "utf-8");
      config = JSON.parse(configContent);
    } catch (error) {
      spinner.error(
        `Failed to read configuration: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return;
    }

    // Check if the current name exists in root or installed
    const currentConfigLocation = config[currentName]
      ? "root"
      : config.installed && config.installed[currentName]
      ? "installed"
      : null;

    if (!currentConfigLocation) {
      spinner.error(
        `\x1b[2m${currentName}\x1b[0m not found in configuration.\n     \x1b[2mTo view all installed repos, use: furi list\x1b[0m`
      );
      return;
    }

    // Check if the new name already exists in root or installed
    if (config[newName] || (config.installed && config.installed[newName])) {
      spinner.error(`\x1b[2m${newName}\x1b[0m already exists in configuration`);
      return;
    }

    // Check if there's a running PM2 process for the current name
    const currentProcessName = `furi_${currentName.replace("/", "-")}`;
    const newProcessName = `furi_${newName.replace("/", "-")}`;
    let isProcessRunning = false;

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
        spinner.update(
          `Stopping process \x1b[2m${currentProcessName}\x1b[0m for \x1b[2m${currentName}\x1b[0m`
        );

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
      spinner.warn(
        `Failed to manage PM2 process: ${
          pmError instanceof Error ? pmError.message : String(pmError)
        }`
      );
      spinner.start(`Continuing with rename`);
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
      spinner.success(
        `Renamed from \x1b[2m${currentName}\x1b[0m to \x1b[2m${newName}\x1b[0m`
      );

      // If process was running, restart it with the new name
      if (isProcessRunning) {
        spinner.start(`Restarting process with new name "${newName}"`);

        try {
          // Get the process configuration from the new location
          const newMcpConfig =
            currentConfigLocation === "root"
              ? config[newName]
              : config.installed[newName];

          const runCommand = newMcpConfig.run || "npm run start";
          const [cmd, ...args] = runCommand.split(" ");
          const cwd = newMcpConfig.source || `.furikake/installed/${newName}`;

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

          spinner.success(
            `Process restarted with new name \x1b[2m${newName}\x1b[0m`
          );
        } catch (startError) {
          spinner.error(
            `Failed to restart process: ${
              startError instanceof Error
                ? startError.message
                : String(startError)
            }`
          );
        } finally {
          // Always disconnect from PM2
          pm2.disconnect();
        }
      }
    } catch (error) {
      spinner.error(
        `Failed to update configuration: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  } catch (error) {
    spinner.error(
      `Error renaming: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};
