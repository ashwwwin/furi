import { createSpinner } from "nanospinner";
import { startMCPCore } from "./actions/startMCP";
import { scanEnvVars } from "../env/actions/scanEnvVars";
import readline from "readline";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import chalk from "chalk";

export const startMCP = async (mcpName: string, envJson?: string) => {
  let config: any;
  let initialEnv: Record<string, string> = {};
  let mcpConfig: any;
  const basePath = process.env.BASE_PATH || "";
  const configPath = join(basePath, ".furikake/configuration.json");

  try {
    if (!basePath) {
      throw new Error("BASE_PATH environment variable is not set");
    }
    config = JSON.parse(readFileSync(configPath, "utf-8"));

    // Check both root level and installed section for MCP configuration
    mcpConfig =
      config[mcpName] || (config.installed && config.installed[mcpName]);

    if (!mcpConfig) {
      console.error(chalk.red(`[${mcpName}] Configuration not found`));
      return;
    }

    // Process the environment variables from the JSON string if provided
    if (envJson) {
      try {
        const parsedEnv = JSON.parse(envJson);

        // Ensure mcpConfig.env exists
        if (!mcpConfig.env) {
          mcpConfig.env = {};
        }

        // Update the environment variables in the configuration
        for (const [key, value] of Object.entries(parsedEnv)) {
          mcpConfig.env[key] = value;
        }

        // Save the updated configuration
        writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
        console.log(
          chalk.green(
            `[${mcpName}] Environment variables saved to configuration`
          )
        );
      } catch (error) {
        console.error(
          chalk.red(
            `[${mcpName}] Error parsing environment variables: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        );
        return;
      }
    }

    if (process.env.PATH) initialEnv.PATH = process.env.PATH;
    if (process.env.NODE_ENV) initialEnv.NODE_ENV = process.env.NODE_ENV;
    if (process.env.HOME) initialEnv.HOME = process.env.HOME;
    if (process.env.USER) initialEnv.USER = process.env.USER;

    if (mcpConfig?.env) {
      for (const [key, value] of Object.entries(mcpConfig.env)) {
        if (value !== undefined && value !== null) {
          initialEnv[key] = String(value);
        }
      }
    }

    const envVars = await scanEnvVars(mcpName);
    const missingEnvVars = envVars.variables.filter((varName) => {
      return initialEnv[varName] === undefined;
    });

    if (missingEnvVars.length > 0) {
      console.warn(
        chalk.yellow(`\n[${mcpName}] Missing environment variable(s)`)
      );
      for (const variable of missingEnvVars) {
        console.warn(chalk.yellow(`     ${chalk.dim(`${variable}=`)}`));
      }

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const askQuestion = (query: string): Promise<string> => {
        return new Promise((resolve) => rl.question(query, resolve));
      };

      let proceed = false;
      let exit = false;

      while (!proceed && !exit) {
        const choice = await askQuestion(
          chalk.white(`\nWhat would you like to do?
     ${chalk.cyan("[1]")} Run anyway (not recommended)
     ${chalk.cyan("[2]")} Input missing values now
     ${chalk.cyan("[3]")} Exit
\nEnter choice: `)
        );

        switch (choice.trim()) {
          case "1":
            console.log(
              chalk.dim(
                `\n[${mcpName}] Proceeding without setting missing variables\n`
              )
            );
            proceed = true;
            break;
          case "2":
            console.log(
              chalk.white(
                `[${mcpName}] Please provide values for the missing variables:`
              )
            );
            for (const varName of missingEnvVars) {
              const value = await askQuestion(
                chalk.dim(`  Enter value for ${chalk.bold(varName)}: `)
              );
              initialEnv[varName] = value;
              // Ensure env exists before assigning
              if (!mcpConfig.env) {
                mcpConfig.env = {};
              }
              mcpConfig.env[varName] = value;
            }
            console.log(
              chalk.green(
                `[${mcpName}] All missing variables provided for this session.`
              )
            );

            // Save the updated configuration to the configuration.json file
            try {
              writeFileSync(
                configPath,
                JSON.stringify(config, null, 2),
                "utf-8"
              );
              console.log(
                chalk.green(
                  `[${mcpName}] Environment variables saved to configuration`
                )
              );
            } catch (writeError) {
              console.error(
                chalk.yellow(
                  `[${mcpName}] Warning: Could not save environment variables to configuration: ${
                    writeError instanceof Error
                      ? writeError.message
                      : String(writeError)
                  }`
                )
              );
            }

            proceed = true;
            break;
          case "3":
            exit = true;
            break;
          default:
            exit = true;
            break;
        }
      }

      rl.close();

      if (exit) {
        console.log(
          chalk.yellow(
            `\n[${mcpName}] Aborted by user due to missing environment variables.`
          )
        );
        return;
      }
    }
  } catch (error) {
    console.error(
      chalk.red(
        `[${mcpName}] Error during pre-start check: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
    return;
  }

  const spinner = createSpinner(`[${mcpName}] Starting`);
  spinner.start();

  try {
    const result = await startMCPCore(mcpName);

    if (result.success) {
      spinner.success({ text: result.message });
    } else {
      spinner.error({ text: result.message });
    }
  } catch (error: any) {
    spinner.error({
      text: `[${mcpName}] Failed to start: ${error.message || String(error)}`,
    });
  }
};
