import chalk from "chalk";
import type { MCPStatus } from "./getPM2Status";

/**
 * Status color mapping
 */
const statusColors: Record<string, (text: string) => string> = {
  online: chalk.green,
  stopped: chalk.red,
  errored: chalk.red,
  stopping: chalk.yellow,
  launching: chalk.blue,
  unknown: chalk.gray,
};

/**
 * Display all MCP statuses in a table
 */
export function displayAllStatuses(statuses: MCPStatus[]): void {
  if (statuses.length === 0) {
    console.log(chalk.yellow("No MCP servers are installed"));
    return;
  }

  // Table header
  console.log(
    "\n" +
      chalk.dim("Name".padEnd(30)) +
      chalk.dim("Status".padEnd(12)) +
      chalk.dim("PID".padEnd(10)) +
      chalk.dim("Memory".padEnd(10)) +
      chalk.dim("CPU".padEnd(10)) +
      chalk.dim("Uptime")
  );

  // Table rows
  statuses.forEach((status) => {
    const statusColor = statusColors[status.status] || chalk.white;
    console.log(
      chalk.white(status.name.padEnd(30)) +
        statusColor(status.status.padEnd(12)) +
        chalk.white((status.pid || "N/A").toString().padEnd(10)) +
        chalk.white(status.memory.padEnd(10)) +
        chalk.white(status.cpu.padEnd(10)) +
        chalk.white(status.uptime)
    );
  });

  console.log(); // Empty line at the end
}

/**
 * Display status for a single MCP
 */
export function displaySingleStatus(status: MCPStatus): void {
  const statusColor =
    status.status === "online"
      ? chalk.green
      : status.status === "stopped" || status.status === "errored"
      ? chalk.red
      : status.status === "stopping" || status.status === "launching"
      ? chalk.yellow
      : chalk.gray;

  console.log(chalk.bold(`\n${chalk.white(status.name)}`));
  console.log(`Status:  ${statusColor(status.status)}`);
  console.log(`PID:     ${status.pid || "N/A"}`);
  console.log(`Memory:  ${status.memory}`);
  console.log(`CPU:     ${status.cpu}`);
  console.log(`Uptime:  ${status.uptime}`);
  console.log(); // Empty line at the end
}
