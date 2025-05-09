import { createSpinner } from "nanospinner";
import {
  getLocalPackageVersion,
  getRemotePackageVersion,
  compareVersions,
  executeUpgrade,
} from "./actions/upgradeFuri";

export async function upgradeFuri() {
  let exitCode = 0;
  const spinner = createSpinner(`Checking for updates`);

  try {
    spinner.start();

    // Get local version
    const localResult = await getLocalPackageVersion();
    const localVersion = localResult.version || "0.0.0";

    if (!localResult.success) {
      spinner.warn(`${localResult.message}, assuming 0.0.0`);
    }

    // Get remote version
    const remoteResult = await getRemotePackageVersion();

    if (!remoteResult.success) {
      // Write the prompt to stdout
      spinner.stop();
      process.stdout.write(
        `\nCould not determine the latest version. Proceed anyway? (y/n) `
      );

      // Read user input from stdin
      let input = "";
      for await (const line of console) {
        input = line;
        break;
      }

      if (input.trim().toLowerCase() !== "y") {
        return spinner.error(`Upgrade cancelled`);
      }

      // Continue with upgrade if confirmed
      spinner.start(`Upgrading Furikake`);
      const upgradeResult = await executeUpgrade();

      return upgradeResult.success
        ? spinner.success(`Upgrade complete\n`)
        : spinner.error(`${upgradeResult.message}`);
    }

    // Compare versions
    const remoteVersion = remoteResult.version as string;
    const versionComparison = compareVersions(localVersion, remoteVersion);

    if (versionComparison === 0) {
      // Already on latest version - just show success and exit
      return spinner.success(`Already on the latest version: v${localVersion}`);
    } else if (versionComparison > 0) {
      // Local version is newer than remote - confirm before downgrading
      spinner.stop();
      process.stdout.write(
        `\nFuri on your machine (${localVersion}) is newer than the latest stable release (${remoteVersion}).\n     Downgrade? (y/n)?`
      );

      // Read user input
      let input = "";
      for await (const line of console) {
        input = line;
        break;
      }

      if (input.trim().toLowerCase() !== "y") {
        return spinner.warn(`Upgrade cancelled`);
      }
    } else {
      // Remote version is newer - proceed automatically without confirmation
      spinner.success(`Update available: ${localVersion} → ${remoteVersion}`);
    }

    // Execute upgrade
    spinner.start(`Upgrading Furikake`);
    const upgradeResult = await executeUpgrade();

    return upgradeResult.success
      ? spinner.success(
          `Upgrade complete\n     \x1b[2mPlease restart your terminal or source your shell profile if needed\x1b[0m`
        )
      : spinner.error(`${upgradeResult.message}`);
  } catch (error: any) {
    exitCode = 1;
    return spinner.error(`Unexpected error: ${error.message || String(error)}`);
  } finally {
    spinner.stop();
    process.exit(exitCode);
  }
}
