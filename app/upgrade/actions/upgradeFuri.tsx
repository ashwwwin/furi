import { $ } from "bun";
import { resolveFromBase } from "@/helpers/paths";

const RemotePackageJSON = "https://api.github.com/repos/ashwwwin/furi/contents/package.json";
const InstallScriptURL = "https://furi.so/install";

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
    // Use GitHub API to avoid caching issues with raw.githubusercontent.com
    const response = await fetch(RemotePackageJSON, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'User-Agent': 'Furikake-CLI-Upgrade-Check'
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        message: `GitHub API request failed with status: ${response.status}`
      };
    }
    
    const apiResponse = await response.json();
    
    // GitHub API returns base64 encoded content
    if (!apiResponse.content) {
      return {
        success: false,
        message: "No content found in GitHub API response"
      };
    }
    
    // Decode base64 content
    const decodedContent = atob(apiResponse.content.replace(/\s/g, ''));
    const rawPkg = JSON.parse(decodedContent);
    
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
  // Split versions into segments
  const v1Parts = v1.split('.');
  const v2Parts = v2.split('.');
  
  // Get the maximum number of segments to compare
  const maxLength = Math.max(v1Parts.length, v2Parts.length);
  
  // Compare each segment
  for (let i = 0; i < maxLength; i++) {
    // Default to "0" if segment doesn't exist
    const v1Part = i < v1Parts.length ? (v1Parts[i] ?? "0") : "0";
    const v2Part = i < v2Parts.length ? (v2Parts[i] ?? "0") : "0";
    
    // Convert to numbers for comparison
    const v1Num = parseInt(v1Part, 10);
    const v2Num = parseInt(v2Part, 10);
    
    // Handle NaN values
    const v1Value = isNaN(v1Num) ? 0 : v1Num;
    const v2Value = isNaN(v2Num) ? 0 : v2Num;
    
    // Compare the segments
    if (v1Value > v2Value) return 1;
    if (v1Value < v2Value) return -1;
  }
  
  // If all segments are equal, versions are equal
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
