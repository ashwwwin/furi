import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolveFromBase, resolveFromUserData } from "@/helpers/paths";

interface Config {
  http?: {
    port?: number;
  };
  aggregator?: {
    port?: number;
  };
  installed?: Record<string, any>;
  [key: string]: any;
}

/**
 * Read the current configuration from configuration.json
 */
export const readConfig = (): Config => {
  const configPath = resolveFromUserData("configuration.json");

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const configContent = readFileSync(configPath, "utf-8");
    return JSON.parse(configContent);
  } catch (error) {
    console.error("Error reading configuration:", error);
    return {};
  }
};

/**
 * Write configuration to configuration.json
 */
export const writeConfig = (config: Config): void => {
  const configPath = resolveFromUserData("configuration.json");

  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing configuration:", error);
    throw error;
  }
};

/**
 * Get the saved HTTP port from configuration, or return default
 */
export const getHttpPort = (defaultPort: number = 9339): number => {
  const config = readConfig();
  return config.http?.port ?? defaultPort;
};

/**
 * Save the HTTP port to configuration
 */
export const saveHttpPort = (port: number): void => {
  const config = readConfig();

  if (!config.http) {
    config.http = {};
  }

  config.http.port = port;
  writeConfig(config);
};

/**
 * Get the saved aggregator port from configuration, or return default
 */
export const getAggregatorPort = (defaultPort: number = 9338): number => {
  const config = readConfig();
  return config.aggregator?.port ?? defaultPort;
};

/**
 * Save the aggregator port to configuration
 */
export const saveAggregatorPort = (port: number): void => {
  const config = readConfig();

  if (!config.aggregator) {
    config.aggregator = {};
  }

  config.aggregator.port = port;
  writeConfig(config);
};

/**
 * Get the socketPath for an MCP from configuration
 */
export const getSocketPath = (mcpName: string): string | null => {
  const config = readConfig();

  // Check if MCP exists in root level
  if (config[mcpName]?.socketPath) {
    return config[mcpName].socketPath;
  }

  // Check for transport key (legacy)
  if (config[mcpName]?.transport) {
    return config[mcpName].transport;
  }

  // Check if MCP exists in installed section
  if (config.installed?.[mcpName]?.socketPath) {
    return config.installed[mcpName].socketPath;
  }

  // Check for transport key in installed section (legacy)
  if (config.installed?.[mcpName]?.transport) {
    return config.installed[mcpName].transport;
  }

  return null;
};
