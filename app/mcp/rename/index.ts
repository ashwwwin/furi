import { createSpinner } from "nanospinner";
import { renamePackage } from "./action/renamePackage";

export const renameMCP = async (
  currentName: string,
  newName: string
): Promise<{ success: boolean; message: string }> => {
  const spinner = createSpinner(
    `Renaming from \x1b[2m${currentName}\x1b[0m to \x1b[2m${newName}\x1b[0m`
  );

  if (newName === "all") {
    const message = "Cannot use all as a new name";
    spinner.error(`Cannot use \x1b[2mall\x1b[0m as a new name`);
    return { success: false, message };
  }

  spinner.start();

  try {
    const result = await renamePackage(currentName, newName);

    // Format the message for spinner display with ANSI codes
    const formatMessage = (msg: string) => {
      return msg
        .replace(
          new RegExp(`\\b${currentName}\\b`, "g"),
          `\x1b[2m${currentName}\x1b[0m`
        )
        .replace(
          new RegExp(`\\b${newName}\\b`, "g"),
          `\x1b[2m${newName}\x1b[0m`
        )
        .replace(
          /\nTo view all installed repos, use: furi list/g,
          "\n     \x1b[2mTo view all installed repos, use: furi list\x1b[0m"
        )
        .replace(/\nWarning:/g, "\n     Warning:")
        .replace(/\nProcess restarted/g, "\n     Process restarted");
    };

    if (result.success) {
      spinner.success(formatMessage(result.message));
    } else {
      spinner.error(formatMessage(result.message));
    }

    return result;
  } catch (error) {
    const message = `Error renaming: ${
      error instanceof Error ? error.message : String(error)
    }`;
    spinner.error(message);
    return { success: false, message };
  }
};
