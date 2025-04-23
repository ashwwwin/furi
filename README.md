# 🍃 Furikake (or furi) (WIP)

Furikake is an easy to use, local CLI & API for MCP management.

![image](https://github.com/user-attachments/assets/8f313cdd-0452-4227-8aea-75127d779f56)

- Download MCP servers [from GitHub]
- Fully featured CLI
- Supports MCP's built with Typescript & Javascript. Python (future).
- HTTP API Routes (uses Bun http, stdio to http, clear and standard routes)
- Process state management [with PM2]
- Logs for each process
- Uses npm to configure and run an MCP
- Built with [Bun](https://bun.sh/) and [Typescript](https://www.typescriptlang.org/)
- is good with rice

## Installation (macOS/Linux)

Firstly, install Bun (if you don't have it already):

```bash
curl -fsSL https://bun.sh/install | bash
```

Then, install Furikake:

```bash
Install script goes here
```

You should now be good to go!

## How to use

#### Manage MCPS

Furikake works with any public github repo as follows:

```bash
furi add <author/repo>
```

_eg. furi add smithery-ai/mcp-fetch_

You can also rename an MCP by using the `rename` command, please note this will restart the MCP if it is running.

```bash
furi rename <old-name> <new-name>
```

_eg. furi rename smithery-ai/mcp-fetch fetch_

#### Delete an MCP

```bash
furi delete <mcp-name>
```

_eg. furi delete fetch_

#### List installed MCPs

Show all installed MCPs

```bash
furi list
```

#### Start an MCP

```bash
furi start <mcp-name> -e <env>
```

-e env is optional and dependant on the MCP server downloaded, in order to view the env variables for an MCP, use:

```bash
furi env <mcp-name>
```

You can get a list of all the tools available (with details) an MCP by using:

```bash
furi tools <mcp-name>
```

#### Stop an MCP

```bash
furi stop <mcp-name>
```

#### Restart an MCP

```bash
furi restart <mcp-name>
```

<!-- #### Check the status of an MCP

```bash
furi status <mcp-name>
```

#### List all running MCPs

```bash
furi status all
``` -->

#### Call a running MCP

```bash
furi call <mcp-name> <toolName> <data>
```

### Using the HTTP API

- Any MCP that is running, will automatically have an http route.
- Turning an MCP on/off can only be done via the cli.

To access your MCP's via http, you can turn on the proxy via:

```bash
furi http start
```

To turn off the route, you can use:

```bash
furi http start
```

#### Routes

- /api/status (to get a list of all running MCPs)
- /api/tools (to get a list of all available tools for all MCPs that are online)
- /api/`mcp-name`/status
- /api/`mcp-name`/restart
- /api/`mcp-name`/logs
- /api/`mcp-name`/tools (to get a list of all available tools for the defined MCP)

`mcp-name` is either `author/repo` or `alias`.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ashwwwin/furi&type=Date)](https://www.star-history.com/#ashwwwin/furi&Date)

## Closing notes

If you've made it this far, I hope you find Furikake useful and time saving. I built this for fun as a way for me to work with MCP's more hands on. If you wish to contribute, feel free to open an issue or a pull request. I will merge after I check out your changes.

If you think this is a good idea, please star the repo. If you think this is a bad idea, please star the repo.

Thanks for checking out Furikake!
