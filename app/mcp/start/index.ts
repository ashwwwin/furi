import { createSpinner } from "nanospinner";
import { readFileSync } from "fs";
import { join } from "path";
import pm2 from "pm2";
import { scanEnvVars } from "../env/actions/scanEnvVars";

export const startMCP = async (packageName: string) => {
  const spinner = createSpinner(`[${packageName}] Starting`);
  spinner.start();

  try {
    const configPath = join(process.cwd(), ".installed/configuration.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    if (!config[packageName]) {
      spinner.error(`[${packageName}] Configuration not found`);
      return;
    }

    const runCommand = config[packageName].run || "npm run start";
    const [cmd, ...args] = runCommand.split(" ");

    const cwd = config[packageName].source || `.installed/${packageName}`;

    let envVars: { variables: string[] } = { variables: [] };
    try {
      envVars = await scanEnvVars(packageName);

      const missingEnvVars = envVars.variables.filter((varName) => {
        return !config[packageName]?.env || !config[packageName].env[varName];
      });

      if (missingEnvVars.length > 0) {
        spinner.warn(
          `[${packageName}] Missing environment variables: ${missingEnvVars.join(
            ", "
          )}`
        );
        spinner.start(`[${packageName}] Continuing startup...`);
      }
    } catch (error) {
      spinner.warn(
        `[${packageName}] Failed to scan environment variables: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      spinner.start(`[${packageName}] Continuing startup...`);
    }

    const env: Record<string, string> = {};

    if (process.env.PATH) env.PATH = process.env.PATH;
    if (process.env.NODE_ENV) env.NODE_ENV = process.env.NODE_ENV;
    if (process.env.HOME) env.HOME = process.env.HOME;
    if (process.env.USER) env.USER = process.env.USER;

    if (config[packageName]?.env) {
      for (const [key, value] of Object.entries(config[packageName].env)) {
        if (value !== undefined && value !== null) {
          env[key] = String(value);
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      pm2.start(
        {
          script: cmd,
          args: args,
          name: `furi_${packageName.replace("/", "-")}`,
          cwd,
          output: join(
            process.cwd(),
            `.logs/${packageName.replace("/", "-")}-out.log`
          ),
          error: join(
            process.cwd(),
            `.logs/${packageName.replace("/", "-")}-error.log`
          ),
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

    spinner.success(`[${packageName}] Started with PM2`);
  } catch (error: any) {
    spinner.error(
      `[${packageName}] Failed to start: ${error.message || String(error)}`
    );
  } finally {
    pm2.disconnect();
  }
};
