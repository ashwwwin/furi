import chalk from "chalk";
import type { MCPStatus } from "./getProcStatus";

/**
 * Status color mapping
 */
const statusColors: Record<string, (text: string) => string> = {
  online: chalk.green,
  offline: chalk.red,
  errored: chalk.red,
  stopping: chalk.yellow,
  launching: chalk.blue,
  unknown: chalk.gray,
};

/**
 * Display all MCP statuses in a table
 */
export function displayStatus(
  statuses: MCPStatus[] | MCPStatus,
  options?: { showDetails?: boolean }
): void {
  if (!statuses) {
    console.log(chalk.yellow("No MCP servers are installed"));
  }

  if (Array.isArray(statuses)) {
    if (statuses.length === 0) {
      console.log(chalk.yellow("No MCP servers are installed"));
      return;
    }
  } else {
    const statusColor =
      statuses.status === "online"
        ? chalk.green
        : statuses.status === "offline" || statuses.status === "errored"
        ? chalk.red
        : statuses.status === "stopping" || statuses.status === "launching"
        ? chalk.yellow
        : chalk.gray;

    console.log(
      `${chalk.bold(
        `${chalk.white(statuses.name)}`
      )}                   (${statusColor(statuses.status)} / ${
        statuses.memory
      } / ${statuses.cpu} / ${statuses.uptime} / ${statuses.pid})`
    );

    return;
  }

  if (options?.showDetails) {
    // Table header
    console.log(
      chalk.dim("MCP name".padEnd(38)) +
        chalk.dim("Status".padEnd(12)) +
        chalk.dim("Memory".padEnd(10)) +
        chalk.dim("CPU".padEnd(10)) +
        chalk.dim("Uptime".padEnd(12.5)) +
        chalk.dim("PID")
    );
  } else {
    console.log(chalk.dim("MCP name".padEnd(38)));
  }

  // Table rows
  statuses.forEach((status) => {
    const statusColor = statusColors[status.status] || chalk.white;
    if (options?.showDetails) {
      console.log(
        chalk.white(status.name.padEnd(38)) +
          statusColor(status.status.padEnd(12)) +
          chalk.white(status.memory.padEnd(10)) +
          chalk.white(status.cpu.padEnd(10)) +
          chalk.white(status.uptime.padEnd(12.5)) +
          chalk.white(status.pid)
      );
    } else {
      console.log(chalk.white(status.name.padEnd(38)));
    }
  });
}
