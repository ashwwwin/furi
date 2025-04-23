# 🍃 Furikake (or furi) (WIP)

Furikake is an easy to use, local CLI & API for MCP management.

- Download MCPs [from GitHub]
- Fully featured CLI (with pretty loading)
- HTTP API Routes (uses Bun http, stdio to http, clear and standard routes)
- Process state management [with PM2]
- Logs for each process
- Uses npm to configure and run an MCP
- Built with [Bun](https://bun.sh/) and [Typescript](https://www.typescriptlang.org/)
- is good with rice

Supports MCP's built with Typescript/Javascript;

## Installation (macOS/Linux)

```bash
curl -fsSL https://bun.sh/install | bash
```

## How to use

#### Manage MCPS

Furikake works with any public github repo as follows:

```bash
furi add <author/repo>
```

_eg. furi add smithery-ai/mcp-fetch_

#### Delete an MCP

```bash
furi delete <author/repo>
```

_eg. furi delete smithery-ai/mcp-fetch_

#### List installed MCPs

Show all installed MCPs

```bash
furi list
```

#### Start an MCP

```bash
furi start <author/repo> -e <env>
```

-e env is optional and dependant on the MCP server downloaded, in order to view the env variables for an MCP, use:

```bash
furi env <author/repo>
```

#### Stop an MCP

```bash
furi stop <author/repo>
```

#### Restart an MCP

```bash
furi restart <author/repo>
```

#### Check the status of an MCP

```bash
furi status <author/repo>
```

#### List all running MCPs

```bash
furi status all
```

#### Call a running MCP

```bash
furi call <author/repo> <toolName> <data>
```

### Using the HTTP API

- Any MCP that is running, will automatically have an http route.
- Turning an MCP on/off can only be done via the cli.

To access your MCP's via http, you can turn on the proxy via:

```bash
furi http on
```

To turn off the route, you can use:

```bash
furi http off
```

#### Routes

- /api/status (to get a list of all running MCPs)
- /api/tools (to get a list of all available tools for all MCPs that are online)
- /api/`mcp-name`/status
- /api/`mcp-name`/restart
- /api/`mcp-name`/logs
- /api/`mcp-name`/tools (to get a list of all available tools for the defined MCP)

`mcp-name` is either `author/repo` or `alias`.

## Closing notes

If you've made it this far, I hope you find Furikake useful and time saving. I built this for fun as a way for me to work with MCP's more hands on. If you wish to contribute, feel free to open an issue or a pull request, I will merge it after I check out your changes.

If you think this is a good idea, please star the repo. If you think this is a bad idea, please star the repo and leave a comment.

Also check out [Bun](https://bun.sh/) if you haven't already!
