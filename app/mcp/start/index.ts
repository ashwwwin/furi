import { createSpinner } from "nanospinner";

export const start = async (packageName: string) => {
  const spinner = createSpinner(`[${packageName}] Starting`);
  spinner.start();

  await Bun.spawn(["npm", "run", "start"], {
    cwd: `.installed/${packageName}`,
    stdout: "inherit",
    stderr: "inherit",
  });

  spinner.success(`[${packageName}] Started`);
};
