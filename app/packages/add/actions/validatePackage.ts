type DetectRepoResult = {
  packageName: string;
  isValid: boolean;
  packageUrl: string;
  isInstalled: boolean;
  alias: string;
};

import { join } from "path";
import { existsSync } from "node:fs";

export const validatePackage = async (
  packageName: string
): Promise<DetectRepoResult> => {
  // Initialize result object
  const result: DetectRepoResult = {
    packageName,
    isValid: false,
    packageUrl: "",
    isInstalled: false,
    alias: packageName,
  };

  // Validate package name format (user/repo)
  const parts = packageName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return result;
  }

  // Set package URL
  const packageUrl = `https://github.com/${packageName}.git`;
  result.packageUrl = packageUrl;

  // Check if repository exists on GitHub
  result.isValid = await checkGitHubRepoExists(packageName);

  // Check if package is already installed
  const basePath = process.env.BASE_PATH;
  if (basePath) {
    const packagePath = join(basePath, ".furikake/installed", packageName);
    result.isInstalled = existsSync(packagePath);

    // Get the alias from the configuration file
    const configPath = join(basePath, "configuration.json");
    const configFile = Bun.file(configPath);
    const configExists = await configFile.exists();
    if (configExists) {
      try {
        const configContent = await configFile.text();
        if (configContent.trim()) {
          const config = JSON.parse(configContent);

          // Find which parent key has source: packagePath
          for (const key in config) {
            if (config[key] && config[key].source === packagePath) {
              result.alias = key;
              break;
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
async function checkGitHubRepoExists(packageName: string): Promise<boolean> {
  try {
    const [owner, repo] = packageName.split("/");
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    const response = await fetch(apiUrl, {
      method: "GET",
    });

    return response.status === 200;
  } catch (error) {
    return false;
  }
}
