import * as git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import * as fs from "fs";
import { getInstalledPath } from "@/helpers/paths";

type CloneRepoResult = {
  success: boolean;
  error: string | null;
};

export const cloneRepo = async (
  packageUrl: string
): Promise<CloneRepoResult> => {
  try {
    const targetDir = getInstalledPath();

    // Ensure target directory exists
    try {
      // Create directory if it doesn't exist
      await Bun.$`mkdir -p ${targetDir}`.quiet();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Failed to create target directory: ${errorMessage}`,
      };
    }

    // Extract repo name from the URL
    const repoName = packageUrl.split("/").pop()?.replace(".git", "") || "repo";
    const repoOwner = packageUrl.split("/")[3];
    const repoPath = `${targetDir}/${repoOwner}/${repoName}`;

    // Clone the repository using isomorphic-git
    await git.clone({
      fs,
      http,
      dir: repoPath,
      url: packageUrl,
      singleBranch: true,
      depth: 1,
    });

    return {
      success: true,
      error: null,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
