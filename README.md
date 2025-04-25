![image](https://github.com/user-attachments/assets/8f313cdd-0452-4227-8aea-75127d779f56)

# 🍃 Furikake (or furi) (WIP)

Furikake is an easy to use, local CLI & API for MCP management.

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

_eg. furi rename smithery-ai/mcp-fetch mcp-fetch_

#### Delete an MCP

```bash
furi delete <mcp-name>
```

_eg. furi delete mcp-fetch_

#### List installed MCPs

Show all installed MCPs

```bash
furi list
```

#### Start an MCP

```bash
furi start <mcp-name> -e <'{"name1":"value1", "name2":"value2"}'>
```

-e env is optional and dependant on the MCP server being called

Ensure you pass a valid JSON object to the `-e` flag.

Once you start a server with the `-e` flag, it will be saved to the config file and re-used when using the server again.

In order to view the env variables required for an MCP, use:

```bash
furi env <mcp-name>
```

You can get a list of all the tools available (with details) of any MCP by using:

```bash
furi tools <mcp-name>
```

then you can call the tool with:

#### Call a tool

```bash
furi call <mcp-name> <tool-name> <'{"param1":"value1", "param2":"value2"}'>
```

#### Stop an MCP

```bash
furi stop <mcp-name>
```

#### Restart an MCP

```bash
furi restart <mcp-name>
```

#### Get the status of all ruuning MCPs

This will show you the status of all running MCPs.

```bash
furi status
```

If you want to get the status of a specific MCP, you can use:

```bash
furi status <mcp-name>
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
furi http stop
```

#### Routes

- /api/status (to get a list of all running MCPs)
- /api/tools (to get a list of all available tools for all MCPs that are online)
- /api/`mcp-name`/status
- /api/`mcp-name`/restart
- /api/`mcp-name`/logs
- /api/`mcp-name`/tools (to get a list of all available tools for the defined MCP)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ashwwwin/furi&type=Date)](https://www.star-history.com/#ashwwwin/furi&Date)

## Closing notes

If you've made it this far, I hope you find Furikake useful and time saving. I built this for fun as a way for me to work with MCP's more hands on. If you wish to contribute, feel free to open an issue or a pull request. I will merge after I check out your changes.

If you think this is a good idea, please star the repo. If you think this is a bad idea, please star the repo.

Thanks for checking out Furikake.
