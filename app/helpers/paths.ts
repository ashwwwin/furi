import { join, resolve, normalize } from "path";

/**
 * Safely resolve paths relative to the base Furikake directory (regardless of whether BASE_PATH has a trailing slash)
 */
export const getBasePath = (): string => {
  const basePath = process.env.BASE_PATH;
  if (!basePath) {
    throw new Error("BASE_PATH environment variable is not set");
  }
  // Normalize the base path to ensure it's consistent
  return normalize(basePath);
};

/**
 * Get the path to the .furikake directory
 */
export const getFurikakePath = (): string => {
  return join(getBasePath(), ".furikake");
};

/**
 * Get the path to the installed packages directory
 */
export const getInstalledPath = (): string => {
  return join(getFurikakePath(), "installed");
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
 * Resolve any path relative to the base path
 */
export const resolveFromBase = (...paths: string[]): string => {
  return join(getBasePath(), ...paths);
};

/**
 * Resolve any path relative to the .furikake directory
 */
export const resolveFromFurikake = (...paths: string[]): string => {
  return join(getFurikakePath(), ...paths);
};
