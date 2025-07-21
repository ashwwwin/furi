![image](https://github.com/user-attachments/assets/8f313cdd-0452-4227-8aea-75127d779f56)

# 🍃 Furikake (or furi)

furi is an easy to use, CLI & API for MCP management.

- Download MCP servers [from GitHub]
- Smithery.yaml detection (or auto detects/handles execution)
- Fully featured CLI [nanospinners, readability]
- Typescript & Javascript MCP's are supported
- Python based MCP's are supported with automatic virtual environment setup
- HTTP API Routes (uses Bun http, stdio to http, clear and standard routes)
- Customizable port and visibility of sudo routes
- View all running MCPs + logs for each process
- Process state management [with PM2](https://pm2.keymetrics.io/)
- Built with [Bun](https://bun.sh/) and [Typescript](https://www.typescriptlang.org/)
- is good with rice

## Installation (macOS/Linux)

To install Furi, you can use the following command:

```bash
curl -fsSL https://furi.so/install | bash
```

Verify the installation by running:

```bash
furi
```

_Furikake uses Bun under the hood, the install script will install Bun if it is not already installed._

### Upgrade Furi

To upgrade Furi to the latest version, run:

```bash
furi upgrade
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

## Using the MCP Aggregator

You can use Furikake with any MCP client such as Cursor via the MCP Aggregator.

Furi collects tools from all running MCPs and exposes them through an SSE endpoint that your app or mcp client can subscribe to. The aggregator automatically builds the list of tools from all running MCPs and listens for new tools as MCPs are started and stopped.

### For MCP Clients that support SSE

To start the aggregator server:

```bash
furi meta start
```

_This will also show you the endpoint your MCP client needs to subscribe to_

### For MCP Clients that only support stdio

Some MCP clients don't support SSE transport and require stdio connections. For these clients, use:

```bash
furi connect
```

This starts the aggregator server directly in stdio mode, allowing MCP clients to connect via stdin/stdout. The server will aggregate all tools from your running MCPs and make them available through the stdio transport.

**Important**: This command provides JSON-only output to comply with MCP protocol requirements. All logging is suppressed to ensure clean communication with MCP clients.

_Note: Unlike `furi meta start`, this command runs in the foreground and maintains the connection directly._

You can specify a custom port:

```bash
furi meta start -p 9338
```

_If you don't pass a port, it will default to 9338_

To stop the aggregator:

```bash
furi meta stop
```

To restart the aggregator (preserving port settings):

```bash
furi meta restart
```

To check the status of the aggregator server:

```bash
furi meta status
```

_To view more output lines, use `-l <lines>`_

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

If you want to secure your API, you can set the `HTTP_AUTH_TOKEN` environment variable.

```bash
export HTTP_AUTH_TOKEN=your-secret-token
```

or in your `.env` file:

```bash
HTTP_AUTH_TOKEN=your-secret-token
```

#### GitHub Rate Limiting

To avoid GitHub API rate limiting when installing packages, you can provide a GitHub personal access token:

```bash
export GITHUB_KEY=your-github-token
```

or in your `.env` file:

```bash
GITHUB_KEY=your-github-token
```

This increases your rate limit from 60 requests/hour to 5,000 requests/hour. You can create a personal access token at [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens).

#### API Response Format

All API endpoints follow a standardized JSON response format:

- **Success responses**:

  ```json
  {
    "success": true,
    "data": {"The response varies by endpoint"}
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

| Endpoint                     | Method | Description                                    | Parameters                                        | Response Format                                                                                                                    |
| ---------------------------- | ------ | ---------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/list`                      | GET    | List running MCPs                              | `?all=true` (optional) to show all installed MCPs | `{"success": true, "data": ["mcpName1", "mcpName2"]}`                                                                              |
| `/tools`                     | GET    | List all available tools from all running MCPs | None                                              | `{"success": true, "data": [{"name": "toolName", "description": "Tool description", "inputSchema": {...}, "mcpName": "mcpName"}]}` |
| `/<mcpName>/tools`           | GET    | List tools for a specific MCP                  | None                                              | `{"success": true, "data": [{"name": "toolName", "description": "Tool description", "inputSchema": {...}}]}`                       |
| `/<mcpName>/call/<toolName>` | POST   | Call a tool on an MCP                          | Tool parameters as JSON in request body           | `{"success": true, "data": {/* Tool-specific response */}}`                                                                        |

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

| Endpoint               | Method | Description                                  | Parameters                                    | Response Format                                                                                                                       |
| ---------------------- | ------ | -------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/status`              | GET    | Get status of all MCPs (running and stopped) | None                                          | `{"success": true, "data": [{"name": "mcpName", "pid": "12345", "status": "online", "cpu": "0%", "memory": "10MB", "uptime": "2h"}]}` |
| `/add/<author>/<repo>` | GET    | Install MCP from GitHub                      | None                                          | `{"success": true, "data": {"installed": true, "message": "Successfully installed"}}`                                                 |
| `/<mcpName>/status`    | GET    | Get status of a specific MCP                 | `?lines=10` (optional) to control log lines   | `{"success": true, "data": {"name": "mcpName", "pid": "12345", "status": "online", "logs": ["log line 1", "log line 2"]}}`            |
| `/<mcpName>/restart`   | GET    | Restart a specific MCP                       | None                                          | `{"success": true, "data": {"restarted": true}}`                                                                                      |
| `/<mcpName>/start`     | POST   | Start a specific MCP                         | Environment variables as JSON in request body | `{"success": true, "data": {"started": true}}`                                                                                        |
| `/<mcpName>/stop`      | GET    | Stop a specific MCP                          | None                                          | `{"success": true, "data": {"stopped": true}}`                                                                                        |
| `/<mcpName>/rename`    | GET    | Rename a specific MCP                        | `?newName=<newName>` (required)               | `{"success": true, "message": "Renamed from oldName to newName"}` or `{"success": false, "message": "Error message"}`                 |
| `/<mcpName>/remove`    | GET    | Delete a specific MCP                        | None                                          | `{"success": true, "data": {"removed": true}}`                                                                                        |
| `/<mcpName>/env`       | GET    | Get environment variables for a specific MCP | None                                          | `{"success": true, "data": {"variables": ["key1", "key2"]}}`                                                                          |

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

Rename an MCP:

```bash
curl "http://localhost:9339/<mcpName>/rename?newName=<newName>"
```

Remove an MCP:

```bash
curl http://localhost:9339/<mcpName>/remove
```

If you face any issues with the HTTP API server, you can use the `furi http status` to debug.

## Closing notes

If you've made it this far, I hope you find Furikake useful and time saving. I built this for fun as a way for me to work with MCP's more hands on. If you wish to contribute, feel free to open an issue or a pull request. I will merge after I check out your changes.

If you think this is a good idea, please star the repo.

Thanks for checking out Furikake.
