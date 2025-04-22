#!/usr/bin/env bun
import { Command } from "commander";
import { addPackage, removePackage, listPackages } from "./app/packages";
import { getEnvironmentVariables } from "./app/mcp";

const program = new Command();

program
  .name("furi")
  .summary("Furikake is a CLI & API for MCP management")
  .version("0.0.1")
  .addHelpText(
    "before",
    `🍃 Furikake
\x1b[2mCLI & API for MCP management\x1b[0m

https://furikake.app
https://github.com/ashwwin/furi\n`
  );

program
  .command("add")
  .description("Install a new MCP")
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    addPackage(packageName);
  });

program
  .command("remove")
  .description("Remove an installed MCP")
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    removePackage(packageName);
  });

program
  .command("list")
  .description("List all installed MCPs")
  .action(() => {
    listPackages();
  });

program
  .command("env")
  .description("Get environment variables for an MCP")
  .argument("<packageName>", "Package name")
  .action((packageName) => {
    getEnvironmentVariables(packageName);
  });

program.parse(process.argv);
