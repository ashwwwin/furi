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
    // Read the configuration.json file
    const configPath = join(process.cwd(), ".furikake/configuration.json");
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

    // Check if the current name exists
    if (!config[currentName]) {
      spinner.error(`\x1b[2m${currentName}\x1b[0m not found in configuration.
     \x1b[2mTo view all installed repos, use: furi list\x1b[0m`);
      return;
    }

    // Check if the new name already exists
    if (config[newName]) {
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

    // Create new entry with same config but different key
    config[newName] = { ...config[currentName] };

    // Delete the old entry
    delete config[currentName];

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
          // Get the process configuration
          const runCommand = config[newName].run || "npm run start";
          const [cmd, ...args] = runCommand.split(" ");
          const cwd =
            config[newName].source || `.furikake/installed/${newName}`;

          // Prepare environment variables
          const env: Record<string, string> = {};
          if (process.env.PATH) env.PATH = process.env.PATH;
          if (process.env.NODE_ENV) env.NODE_ENV = process.env.NODE_ENV;
          if (process.env.HOME) env.HOME = process.env.HOME;
          if (process.env.USER) env.USER = process.env.USER;

          // Add package-specific environment variables
          if (config[newName]?.env) {
            for (const [key, value] of Object.entries(config[newName].env)) {
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
                output: join(
                  process.cwd(),
                  `.furikake/logs/${newName.replace("/", "-")}-out.log`
                ),
                error: join(
                  process.cwd(),
                  `.furikake/logs/${newName.replace("/", "-")}-error.log`
                ),
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
