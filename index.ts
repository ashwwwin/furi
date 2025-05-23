#!/usr/bin/env bun
import { Command } from "commander";
import { addPackage, removePackage, listPackages } from "@/packages";
import {
  getEnvironmentVariables,
  stopMCP,
  startMCP,
  renameMCP,
  restartMCP,
  statusMCP,
} from "@/mcp";
import { callTool, listTools } from "@/tools";
import {
  startHttpServer,
  stopHttpServer,
  restartHttpServer,
  httpStatus,
} from "@/http";
import {
  startMCPAggregatorServer,
  stopMCPAggregatorServer,
  restartMCPAggregatorServer,
  aggregatorStatus,
} from "@/aggregator";
import { upgradeFuri } from "@/upgrade";
import { getBasePath, getFurikakePath } from "@/helpers/paths";
import { version } from "./package.json";

const program = new Command();

program
  .name("furi")
  .summary("Furikake is a CLI & API for MCP management and execution")
  .version(version)
  .addHelpText(
    "before",
    `\x1b[2m🍃 Furikake
CLI & API for MCP management and execution

https://furikake.app
https://github.com/ashwwwin/furi\n\x1b[0m`
  )
  .showHelpAfterError()
  .showSuggestionAfterError();

// Set a default action if no command is specified
if (process.argv.length <= 2) {
  process.argv.push("--help");
}

program
  .command("add")
  .description("Install a new MCP server")
  .argument("<mcpName>", "MCP name")
  .action((mcpName) => {
    addPackage(mcpName);
  });

program
  .command("remove")
  .description("Remove an installed MCP server")
  .argument("<mcpName>", "MCP name")
  .action((mcpName) => {
    removePackage(mcpName);
  });

program
  .command("list")
  .description("List all installed MCP servers")
  .option("-d, --details", "Show detailed status information")
  .action((options) => {
    listPackages(options.details);
  });

program
  .command("env")
  .description("Get environment variables for the MCP server")
  .argument("<mcpName>", "MCP name")
  .action((mcpName) => {
    getEnvironmentVariables(mcpName);
  });

program
  .command("start")
  .description("Start an MCP server")
  .argument("<mcpName>", "MCP name")
  .option(
    "-e, --env <json>",
    'Environment variables as JSON string: \'{"key":"value"}\''
  )
  .action((mcpName, options) => {
    startMCP(mcpName, options.env);
  });

program
  .command("stop")
  .description("Stop an MCP server")
  .argument("<mcpName>", "MCP name")
  .action((mcpName) => {
    stopMCP(mcpName);
  });

program
  .command("restart")
  .description("Restart an MCP server")
  .argument("<mcpName>", "MCP name")
  .action((mcpName) => {
    restartMCP(mcpName);
  });

program
  .command("status")
  .description("Get the status of an MCP server")
  .argument("[mcpName]", "MCP Name (defaults to 'all' to show all MCPs)", "all")
  .option(
    "-l, --lines <number>",
    "Number of log lines to show (for single MCP)",
    "15"
  )
  .action((mcpName, options) => {
    statusMCP(mcpName, options.lines);
  });

program
  .command("rename")
  .description("Rename an alias in the configuration")
  .argument("<currentName>", "Current name/alias")
  .argument("<newName>", "New name/alias")
  .action((currentName, newName) => {
    renameMCP(currentName, newName);
  });

program
  .command("tools")
  .description("List all tools for an MCP server")
  .argument("[mcpName]", "MCP Name (defaults to 'all' to show all MCPs)", "all")
  .action((mcpName) => {
    listTools(mcpName);
  });

program
  .command("call")
  .description("Call a tool")
  .argument("<mcpName>", "MCP name")
  .argument("<toolName>", "Tool name")
  .argument("<data>", "Data")
  .action((mcpName, toolName, data) => {
    callTool(mcpName, toolName, data);
  });

program
  .command("where")
  .description("Show the path to the .furikake directory")
  .option("-j, --json", "Output the path in JSON format")
  .action((options) => {
    if (options.json) {
      console.log(
        JSON.stringify({
          furikakePath: getFurikakePath(),
        })
      );
    } else {
      console.log(
        `Furikake is stored in: \n     \x1b[2m${getFurikakePath()}\x1b[0m`
      );
    }
  });

const httpCommand = new Command("http").description("HTTP API");

httpCommand
  .command("start")
  .description("Start the HTTP API server")
  .option("-p, --port <port>", "Port number", "9339")
  .option("--sudo", "Expose sudo routes", false)
  .action(async (options) => {
    const port = parseInt(options.port || "9339");
    await startHttpServer(port, options.sudo);
  });

httpCommand
  .command("stop")
  .description("Stop the HTTP API server")
  .action(async () => {
    await stopHttpServer();
  });

httpCommand
  .command("restart")
  .description(
    "Restart the running HTTP API server (preserves --sudo and port settings)"
  )
  .action(async () => {
    await restartHttpServer();
  });

httpCommand
  .command("status")
  .description("Show the status of the HTTP API server")
  .option("--lines <number>", "Number of log lines to show", "15")
  .action(async (options) => {
    const lines = parseInt(options.lines, 10);
    await httpStatus(lines);
  });

const metaCommand = new Command("meta").description("MCP Aggregator");

metaCommand
  .command("start")
  .description("Starts the MCP aggregation server")
  // .option("-t, --transport <transport>", "Transport type", "sse")
  .option("-p, --port <port>", "Port number", "9338")
  .action((options) => {
    // const transport = options.transport || "sse";
    const transport = "sse";
    const port = parseInt(options.port, 10);

    startMCPAggregatorServer(transport, port);
  });

metaCommand
  .command("stop")
  .description("Stops the Meta MCP Aggregator server")
  .action(async () => {
    await stopMCPAggregatorServer();
  });

metaCommand
  .command("restart")
  .description("Restarts the Meta MCP Aggregator server")
  .action(async () => {
    await restartMCPAggregatorServer();
  });

metaCommand
  .command("status")
  .description("Shows the status of the Meta MCP Aggregator server")
  .option("-l, --lines <lines>", "Number of log lines to show", "15")
  .action(async (options) => {
    const lines = parseInt(options.lines, 10);
    await aggregatorStatus(lines);
  });

program.addCommand(httpCommand);
program.addCommand(metaCommand);

program
  .command("upgrade")
  .description("Upgrade Furikake to the latest version")
  .action(async () => {
    await upgradeFuri();
  });

program.parse(process.argv);
