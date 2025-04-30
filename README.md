![image](https://github.com/user-attachments/assets/8f313cdd-0452-4227-8aea-75127d779f56)

# 🍃 Furikake (or furi) (WIP)

Furikake is an easy to use, local CLI & API for MCP management.

- Download MCP servers [from GitHub]
- Smithery.yaml detection (source of execution)
- Automatically tries to handle build, run if unspecified
- Fully featured CLI [nanospinners, readability]
- Typescript & Javascript MCP's built in are supported
- Python based MCP's are a key roadmap item (and will be supported)
- HTTP API Routes (uses Bun http, stdio to http, clear and standard routes)
- Customizable port and visibility of sudo routes
- View all running MCPs + logs for each process
- Process state management [with PM2](https://pm2.keymetrics.io/)
- Built with [Bun](https://bun.sh/) and [Typescript](https://www.typescriptlang.org/)
- is good with rice

## Installation (macOS/Linux)

Firstly, install Bun (if you don't have it already):

```bash
curl -fsSL https://bun.sh/install | bash
```

Then, install Furikake:

```bash
curl -fsSL https://furikake.app/install | bash
```

Verify the installation by running:

```bash
furi help
```

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
furi remove <mcpName>
```

_eg. furi remove mcp-fetch_

#### List installed MCPs

Show all installed MCPs

```bash
furi list
```

#### Start an MCP

```bash
furi start <mcpName> -e '{"name1":"value1", "name2":"value2"}'
```

-e env is optional and dependant on the MCP server being called

Ensure you pass a valid JSON object to the `-e` flag.

Once you start a server with the `-e` flag, it will be saved to the config file and re-used when using the server again.

In order to view the env variables required for an MCP, use:

```bash
furi env <mcpName>
```

You can get a list of all the tools available (with details) of any MCP by using:

```bash
furi tools <mcpName>
```

then you can call the tool with:

#### Call a tool

```bash
furi call <mcpName> <toolName> '{"param1":"value1", "param2":"value2"}'
```

_Parameters must be a valid JSON string enclosed in single quotes_

#### Stop an MCP

```bash
furi stop <mcpName>
```

#### Restart an MCP

```bash
furi restart <mcpName>
```

#### Get the status of all running MCPs

This will show you the status of all running MCPs.

```bash
furi status
```

If you want to get the logs a specific MCP, you can use:

```bash
furi status <mcpName>
```

_to view more output lines, use `-l <lines>`_

#### Configuration storage

All installed MCPs, your configuration and logs are stored in the `.furikake` directory which can be located by running:

```bash
furi where
```

## Using the HTTP API

- Any MCP that is running, will automatically have an http route.
- Turning an MCP on/off can only be done via the cli.

To access your MCP's via http, you can turn on the proxy via:

```bash
furi http start
```

In order to pass a port, you can use the `http start -p <port>` flag.

```bash
furi http start -p 9339
```

_If you don't pass a port, it will default to 9339_

To turn off the route, you can use:

```bash
furi http stop
```

### HTTP API Routes

API Routes are divided into two types (public routes and sudo routes). You can access the public routes by default.

#### ➤ Public routes

To view all running MCPs, you can use:

```bash
/list
```

_if you wish to see all installed MCPs, you can add `?all=true` to the route_

To view all available tools for all MCPs that are online, you can use:

```bash
/tools
```

To call a tool for a specific MCP, you can use:

```bash
/`mcpName`/call/`toolName`
```

This is the only route that uses a POST request, it can be used like this:

```bash
curl -X POST http://localhost:9339/`mcpName`/call/`toolName` -d '{"param1":"value1", "param2":"value2"}'
```

Get a list of all available tools for the defined MCP by running:

```bash
/`mcpName`/tools
```

#### ➤ Sudo routes

If you need sudo routes, you can use start with the `sudo` flag:

```bash
furi http start --sudo
```

With sudo routes, you can actively manage packages and instances via the http api.

- /add/`author/repo` (to install a new MCP from a github repo)
- /status (to get a list of all running MCPs)
- /`mcpName`/status
- /`mcpName`/restart
- /`mcpName`/start
- /`mcpName`/stop
- /`mcpName`/remove

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ashwwwin/furi&type=Date)](https://www.star-history.com/#ashwwwin/furi&Date)

## Closing notes

If you've made it this far, I hope you find Furikake useful and time saving. I built this for fun as a way for me to work with MCP's more hands on. If you wish to contribute, feel free to open an issue or a pull request. I will merge after I check out your changes.

If you think this is a good idea, please star the repo. If you think this is a bad idea, please star the repo.

Thanks for checking out Furikake.
