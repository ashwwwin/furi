type DetectRepoResult = {
  mcpName: string;
  isValid: boolean;
  packageUrl: string;
  isInstalled: boolean;
  alias: string;
};

import { join } from "path";
import { existsSync } from "node:fs";

export const validatePackage = async (
  mcpName: string
): Promise<DetectRepoResult> => {
  // Initialize result object
  const result: DetectRepoResult = {
    mcpName,
    isValid: false,
    packageUrl: "",
    isInstalled: false,
    alias: mcpName,
  };

  // Validate MCP Name format (user/repo)
  const parts = mcpName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return result;
  }

  // Set package URL
  const packageUrl = `https://github.com/${mcpName}.git`;
  result.packageUrl = packageUrl;

  // Check if repository exists on GitHub
  result.isValid = await checkGitHubRepoExists(mcpName);

  // Check if package is already installed
  const basePath = process.env.BASE_PATH;
  if (basePath) {
    const packagePath = join(basePath, ".furikake/installed", mcpName);
    result.isInstalled = existsSync(packagePath);

    // Get the alias from the configuration file
    const configPath = join(basePath, ".furikake/configuration.json");
    const configFile = Bun.file(configPath);
    const configExists = await configFile.exists();
    if (configExists) {
      try {
        const configContent = await configFile.text();
        if (configContent.trim()) {
          const config = JSON.parse(configContent);

          // Find which parent key has source: packagePath
          // Check root level first
          for (const key in config) {
            const potentialPackageConfig = config[key];
            // Check if the value is an object and has the expected 'source' property that matches the target path
            if (
              potentialPackageConfig &&
              typeof potentialPackageConfig === "object" &&
              potentialPackageConfig.source === packagePath
            ) {
              result.alias = key;
              break; // Found in root
            }
          }

          // If not found in root, check installed section
          if (result.alias === mcpName && config.installed) {
            for (const key in config.installed) {
              if (
                config.installed[key] &&
                config.installed[key].source === packagePath
              ) {
                result.alias = key;
                break; // Found in installed
              }
            }
          }
        }
      } catch (error) {
        // Silently continue if there's an error parsing the config
        console.error("Error parsing configuration:", error);
      }
    }
  }

  return result;
};

/**
 * Checks if a GitHub repository exists by making a request to the GitHub API
 * Using Bun's native fetch API
 */
async function checkGitHubRepoExists(mcpName: string): Promise<boolean> {
  try {
    const [owner, repo] = mcpName.split("/");
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    const response = await fetch(apiUrl, {
      method: "GET",
    });

    return response.status === 200;
  } catch (error) {
    return false;
  }
}
