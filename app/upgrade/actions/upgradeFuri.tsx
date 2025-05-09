import { $ } from "bun";
import { resolveFromBase } from "@/helpers/paths";

const RemotePackageJSON = "https://raw.githubusercontent.com/ashwwwin/furi/main/package.json";
const InstallScriptURL = "https://furikake.app/install";

// Common result type pattern
interface ActionResult {
  success: boolean;
  message: string;
}

interface VersionedActionResult extends ActionResult {
  version?: string;
}

// Type guard to check for package.json version structure
function isValidPackageJson(pkg: unknown): pkg is { version?: string } {
  return (
    typeof pkg === "object" &&
    pkg !== null &&
    (typeof (pkg as any).version === "string" ||
      typeof (pkg as any).version === "undefined")
  );
}

// Get the local package version
export async function getLocalPackageVersion(): Promise<VersionedActionResult> {
  try {
    const packageJsonPath = resolveFromBase("package.json");
    const rawPkg = await Bun.file(packageJsonPath).json();
    if (isValidPackageJson(rawPkg) && typeof rawPkg.version === "string") {
      return {
        success: true,
        message: "Local version found",
        version: rawPkg.version
      };
    }
    return {
      success: false,
      message: "Local package.json missing or invalid version"
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Could not read local package.json: ${errorMessage}`
    };
  }
}

// Get the remote package version
export async function getRemotePackageVersion(): Promise<VersionedActionResult> {
  try {
    const response = await fetch(RemotePackageJSON);
    if (!response.ok) {
      return {
        success: false,
        message: `GitHub request failed with status: ${response.status}`
      };
    }
    
    const rawPkg = await response.json();
    if (isValidPackageJson(rawPkg) && typeof rawPkg.version === "string") {
      return {
        success: true,
        message: "Remote version found",
        version: rawPkg.version
      };
    }
    
    return {
      success: false,
      message: "Remote package.json missing or invalid version"
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Error fetching remote package.json: ${errorMessage}`
    };
  }
}

// Compare semantic versions
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// Execute the actual upgrade process
export async function executeUpgrade(): Promise<ActionResult> {
  try {
    const proc = await $`curl -fsSL ${InstallScriptURL} | bash`.quiet();
    
    if (proc.exitCode === 0) {
      return {
        success: true,
        message: "Upgrade complete"
      };
    }
    
    const stderrOutput = proc.stderr.toString().trim();
    const message = `Upgrade failed with exit code: ${proc.exitCode}${stderrOutput ? `\nError details: ${stderrOutput}` : ""}`;
    return { 
      success: false,
      message: message
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Upgrade failed: ${errorMessage}`
    };
  }
}
