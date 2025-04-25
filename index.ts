#!/usr/bin/env bun
import { Command } from "commander";
import { addPackage, removePackage, listPackages } from "./app/packages";
import {
  getEnvironmentVariables,
  stopMCP,
  startMCP,
  renameMCP,
  restartMCP,
} from "./app/mcp";
import { callTool, listTools } from "./app/tools";
import { startHttpServer, stopHttpServer, restartHttpServer } from "./app/http";

const program = new Command();

program
  .name("furi")
  .summary("Furikake is a CLI & API for MCP management")
  .version("0.0.1")
  .addHelpText(
    "before",
    `\x1b[2m🍃 Furikake
CLI & API for MCP management

https://furikake.app
https://github.com/ashwwin/furi\n\x1b[0m`
  );

program
  .command("add")
  .description("Install a new MCP server")
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    addPackage(packageName);
  });

program
  .command("remove")
  .description("Remove an installed MCP server")
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    removePackage(packageName);
  });

program
  .command("list")
  .description("List all installed MCP servers")
  .action(() => {
    listPackages();
  });

program
  .command("env")
  .description("Get environment variables for the MCP server")
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    getEnvironmentVariables(packageName);
  });

program
  .command("start")
  .description("Start an MCP server")
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    startMCP(packageName);
  });

program
  .command("stop")
  .description("Stop an MCP server")
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    stopMCP(packageName);
  });

program
  .command("restart")
  .description("Restart an MCP server")
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    restartMCP(packageName);
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
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    listTools(packageName);
  });

program
  .command("call")
  .description("Call a tool")
  .argument("<packageName>", "Package name")
  .argument("<toolName>", "Tool name")
  .argument("<data>", "Data")
  .action((packageName, toolName, data) => {
    callTool(packageName, toolName, data);
  });

const httpCommand = new Command("http").description("HTTP API");

httpCommand
  .command("start")
  .description("Start the HTTP API server")
  .option("-p, --port <port>", "Port number", "9339")
  .action(async (options) => {
    const port = parseInt(options.port || "9339");
    await startHttpServer(port);
  });

httpCommand
  .command("stop")
  .description("Stop the HTTP API server")
  .action(async () => {
    await stopHttpServer();
  });

httpCommand
  .command("restart")
  .description("Restart the running HTTP API server (server must be running)")
  .action(async () => {
    await restartHttpServer();
  });

program.addCommand(httpCommand);
program.parse(process.argv);
