type DetectRepoResult = {
  mcpName: string;
  isValid: boolean;
  packageUrl: string;
  isInstalled: boolean;
  alias: string;
  error?: string; // Add error field for detailed error messages
};

import { join } from "path";
import { existsSync } from "node:fs";
import {
  getPackagePath,
  resolveFromBase,
  resolveFromUserData,
} from "@/helpers/paths";

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
    result.error =
      "Invalid package name format. Expected format: 'author/repo'";
    return result;
  }

  // Set package URL
  const packageUrl = `https://github.com/${mcpName}.git`;
  result.packageUrl = packageUrl;

  // Check if repository exists on GitHub
  const { exists, error } = await checkGitHubRepoExists(mcpName);
  result.isValid = exists;
  if (error) {
    result.error = error;
  }

  // Check if package is already installed
  const owner = parts[0];
  const repo = parts[1];
  const packagePath = getPackagePath(owner, repo);
  result.isInstalled = existsSync(packagePath);

  // Get the alias from the configuration file
  const configPath = resolveFromUserData("configuration.json");
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

  return result;
};

/**
 * Checks if a GitHub repository exists by making a request to the GitHub API
 * Using Bun's native fetch API
 */
async function checkGitHubRepoExists(
  mcpName: string
): Promise<{ exists: boolean; error?: string }> {
  try {
    const [owner, repo] = mcpName.split("/");
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    // Prepare headers with optional GitHub authentication
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "furikake-cli",
    };

    // Add GitHub authentication if GITHUB_KEY environment variable is available
    const githubToken = process.env.GITHUB_KEY;
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
    });

    if (response.status === 200) {
      return { exists: true };
    } else if (response.status === 404) {
      return {
        exists: false,
        error: `Repository '${mcpName}' not found on GitHub`,
      };
    } else if (response.status === 403) {
      // Check if it's rate limited
      const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
      if (rateLimitRemaining === "0") {
        return {
          exists: false,
          error: "GitHub API rate limit exceeded. Please try again later.",
        };
      }
      return {
        exists: false,
        error: "Access forbidden. The repository may be private.",
      };
    } else {
      return {
        exists: false,
        error: `GitHub API returned status ${response.status}`,
      };
    }
  } catch (error) {
    return {
      exists: false,
      error: `Failed to check repository: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
