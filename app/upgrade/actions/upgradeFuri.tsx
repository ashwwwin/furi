import { $ } from "bun";
import { resolveFromFurikake } from "@/helpers/paths";

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
    const packageJsonPath = resolveFromFurikake("package.json");
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
  // Parse version components as numbers
  const v1Parts = v1.split('.').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  const v2Parts = v2.split('.').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  // Normalize version parts to ensure they have the same length
  const maxLength = Math.max(v1Parts.length, v2Parts.length);
  const normalizedV1Parts = [...v1Parts];
  const normalizedV2Parts = [...v2Parts];
  
  while (normalizedV1Parts.length < maxLength) normalizedV1Parts.push(0);
  while (normalizedV2Parts.length < maxLength) normalizedV2Parts.push(0);
  
  // Compare each component
  for (let i = 0; i < maxLength; i++) {
    const part1 = normalizedV1Parts[i] ?? 0;
    const part2 = normalizedV2Parts[i] ?? 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0; // Versions are equal
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
