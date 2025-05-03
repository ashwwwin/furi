![image](https://github.com/user-attachments/assets/8f313cdd-0452-4227-8aea-75127d779f56)

# 🍃 Furikake (or furi) (WIP)

Furikake is an easy to use, local CLI & API for MCP management and execution.

- Download MCP servers [from GitHub]
- Smithery.yaml detection (or auto detects/handles execution)
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
furi
```

## How to use

### Manage MCPs

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

### HTTP API Reference

The Furikake HTTP API is divided into **public routes** and **sudo routes**. Public routes are accessible by default, while sudo routes must be explicitly enabled. With sudo routes, you can actively manage packages and instances via the HTTP API.

#### API Response Format

All API endpoints follow a standardized JSON response format:

- **Success responses**:

  ```json
  {
    "success": true,
    "data": {...}  // The response data varies by endpoint
  }
  ```

- **Error responses**:
  ```json
  {
    "success": false,
    "message": "Descriptive error message"
  }
  ```

#### HTTP Methods

- **POST** - Used only for `/mcpName/call/toolName` and `/mcpName/start` endpoints
- **GET** - Used for all other endpoints

### Public Routes

| Endpoint                     | Method | Description                                    | Parameters                                        |
| ---------------------------- | ------ | ---------------------------------------------- | ------------------------------------------------- |
| `/list`                      | GET    | List running MCPs                              | `?all=true` (optional) to show all installed MCPs |
| `/tools`                     | GET    | List all available tools from all running MCPs | None                                              |
| `/<mcpName>/tools`           | GET    | List tools for a specific MCP                  | None                                              |
| `/<mcpName>/call/<toolName>` | POST   | Call a tool on an MCP                          | Tool parameters as JSON in request body           |

#### Example Usage:

List running MCPs:

```bash
curl http://localhost:9339/list
```

To view all available tools for all online MCPs, you can use:

```bash
curl "http://localhost:9339/list"
```

List tools for all online MCPs:

```bash
curl http://localhost:9339/tools
```

List tools for a specific MCP:

```bash
curl http://localhost:9339/<mcpName>/tools
```

Call a tool:

```bash
curl -X POST http://localhost:9339/<mcpName>/call/<toolName> -d '{"data1":"value1", "data2":"value2"}'
```

### Sudo Routes

To enable sudo routes that allow API management of MCPs:

```bash
furi http start --sudo
```

| Endpoint               | Method | Description                                  | Parameters                                    |
| ---------------------- | ------ | -------------------------------------------- | --------------------------------------------- |
| `/status`              | GET    | Get status of all MCPs (running and stopped) | None                                          |
| `/add/<author>/<repo>` | GET    | Install MCP from GitHub                      | None                                          |
| `/<mcpName>/status`    | GET    | Get status of a specific MCP                 | `?lines=10` (optional) to control log lines   |
| `/<mcpName>/restart`   | GET    | Restart a specific MCP                       | None                                          |
| `/<mcpName>/start`     | POST   | Start a specific MCP                         | Environment variables as JSON in request body |
| `/<mcpName>/stop`      | GET    | Stop a specific MCP                          | None                                          |
| `/<mcpName>/remove`    | GET    | Delete a specific MCP                        | None                                          |

#### Example Usage:

Get status of all MCPs:

```bash
curl http://localhost:9339/status
```

Install an MCP:

```bash
curl http://localhost:9339/add/<author>/<repo>
```

Get status and logs of a specific MCP:

```bash
curl "http://localhost:9339/<mcpName>/status?lines=20"
```

Start an MCP with environment variables:

```bash
curl -X POST http://localhost:9339/<mcpName>/start -d '{"API_KEY":"your-api-key-here"}'
```

Restart an MCP:

```bash
curl http://localhost:9339/<mcpName>/restart
```

Stop an MCP:

```bash
curl http://localhost:9339/<mcpName>/stop
```

Remove an MCP:

```bash
curl http://localhost:9339/<mcpName>/remove
```

If you face any issues with the HTTP API server, you can use the `furi http status` to debug.

## Roadmap

- Different Node versions can be read and handled from package.json and passed to the pm2 interpreter with nvm
- Python MCP support
- Tests (for the entire project)

This is not in order, likely missing items and subject to change.

## Closing notes

If you've made it this far, I hope you find Furikake useful and time saving. I built this for fun as a way for me to work with MCP's more hands on. If you wish to contribute, feel free to open an issue or a pull request. I will merge after I check out your changes.

If you think this is a good idea, please star the repo.

Thanks for checking out Furikake.
