import { Socket } from "net";

/**
 * UnixSocketTransport for MCP connections
 *
 * This class implements the MCP transport interface for Unix domain sockets.
 * It provides bidirectional communication with an MCP server through Unix sockets.
 *
 * The implementation follows the MCP transport interface spec and is compatible
 * with the @modelcontextprotocol/sdk Client class.
 */
export class UnixSocketTransport {
  private socket: Socket | null = null;
  private socketPath: string;
  private buffer: string = "";
  private isConnected: boolean = false;
  private connecting: Promise<void> | null = null;

  // These handlers are set by the MCP Protocol class
  public onmessage: ((message: any) => void) | null = null;
  public onerror: ((error: Error) => void) | null = null;
  public onclose: (() => void) | null = null;

  /**
   * Creates a new Unix socket transport
   * @param socketPath Path to the Unix socket file
   */
  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  /**
   * Initializes and connects to the Unix socket
   * This method is required by the MCP SDK and is called by the Protocol class
   */
  async start(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = new Promise<void>((resolve, reject) => {
      try {
        this.socket = new Socket();

        // Set up event handlers
        this.socket.on("connect", () => {
          // console.log(`[UnixSocket] Connected to ${this.socketPath}`);
          this.isConnected = true;
          resolve();
        });

        this.socket.on("error", (error) => {
          // console.error(`[UnixSocket] Error: ${error.message}`);
          if (this.onerror) {
            this.onerror(error);
          }

          if (!this.isConnected) {
            reject(error);
          }
        });

        this.socket.on("close", () => {
          // console.log(`[UnixSocket] Connection closed`);
          this.isConnected = false;
          if (this.onclose) {
            this.onclose();
          }
        });

        this.socket.on("data", (data) => {
          this.buffer += data.toString();

          // Process complete messages (line-delimited JSON-RPC)
          const lines = this.buffer.split("\n");
          this.buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line);
                if (this.onmessage) {
                  this.onmessage(message);
                }
              } catch (error) {
                // console.error("[UnixSocket] Failed to parse message:", error);
              }
            }
          }
        });

        // Connect to the Unix socket
        this.socket.connect(this.socketPath);
      } catch (error) {
        this.isConnected = false;
        reject(error);
      }
    });

    return this.connecting;
  }

  /**
   * Connects to the Unix socket - alias for start() for compatibility
   */
  async connect(): Promise<void> {
    return this.start();
  }

  /**
   * Sends a message through the Unix socket
   * @param message The message to send (will be JSON-stringified)
   */
  async send(message: any): Promise<void> {
    if (!this.isConnected) {
      await this.start();
    }

    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    const data = JSON.stringify(message) + "\n";

    return new Promise<void>((resolve, reject) => {
      this.socket!.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Closes the Unix socket connection
   */
  async close(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.isConnected = false;
      this.connecting = null;
    }
  }
}
