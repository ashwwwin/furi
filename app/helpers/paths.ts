import { join, resolve, normalize } from "path";
import { homedir } from "os";

/**
 * Safely resolve paths relative to the base Furikake directory (.furikake)
 */
export const getBasePath = (): string => {
  let basePath = process.env.BASE_PATH;

  if (!basePath) {
    // For compiled binaries or when BASE_PATH is not set, default to .furikake in home directory
    basePath = join(homedir(), ".furikake");
  }

  // Resolve to absolute path and normalize to ensure it's consistent
  return normalize(resolve(basePath));
};

/**
 * Get the path to the installed packages directory
 */
export const getInstalledPath = (): string => {
  return join(getBasePath(), "installed");
};

/**
 * Get the path to a specific installed package
 */
export const getPackagePath = (
  packageOwner: string,
  packageName: string
): string => {
  return join(getInstalledPath(), packageOwner, packageName);
};

/**
 * Resolve any path relative to the base path (.furikake directory)
 */
export const resolveFromBase = (...paths: string[]): string => {
  return join(getBasePath(), ...paths);
};
