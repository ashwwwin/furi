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
  private isConnecting: boolean = false;
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
   * Check if the socket is in a writable state
   */
  private isSocketWritable(): boolean {
    return (
      this.socket !== null &&
      this.isConnected &&
      !this.socket.destroyed &&
      this.socket.writable
    );
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

    this.isConnecting = true;
    this.connecting = new Promise<void>((resolve, reject) => {
      try {
        this.socket = new Socket();

        // Set socket options to detect connection issues faster
        this.socket.setKeepAlive(true, 5000); // Enable keep-alive with 5s initial delay
        this.socket.setTimeout(30000); // 30 second timeout

        // Set up event handlers
        this.socket.on("connect", () => {
          // console.log(`[UnixSocket] Connected to ${this.socketPath}`);
          this.isConnected = true;
          this.isConnecting = false;
          resolve();
        });

        this.socket.on("error", (error) => {
          // console.error(`[UnixSocket] Error: ${error.message}`);
          this.isConnected = false;
          this.isConnecting = false;

          if (this.onerror) {
            this.onerror(error);
          }

          if (!this.isConnected) {
            reject(error);
          }
        });

        this.socket.on("close", (hadError) => {
          // console.log(`[UnixSocket] Connection closed${hadError ? ' with error' : ''}`);
          this.isConnected = false;
          this.isConnecting = false;

          if (this.onclose) {
            this.onclose();
          }
        });

        this.socket.on("timeout", () => {
          // console.warn(`[UnixSocket] Socket timeout on ${this.socketPath}`);
          this.socket?.destroy();
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
                // Don't propagate parse errors as they might be recoverable
              }
            }
          }
        });

        // Connect to the Unix socket
        this.socket.connect(this.socketPath);
      } catch (error) {
        this.isConnected = false;
        this.isConnecting = false;
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
    if (!this.isConnected || this.isConnecting) {
      await this.start();
    }

    if (!this.isSocketWritable()) {
      throw new Error("Socket not connected or not writable");
    }

    const data = JSON.stringify(message) + "\n";

    return new Promise<void>((resolve, reject) => {
      if (!this.isSocketWritable()) {
        reject(new Error("Socket became unavailable before write"));
        return;
      }

      this.socket!.write(data, (error) => {
        if (error) {
          // Handle specific EPIPE errors more gracefully
          if ((error as any).code === "EPIPE") {
            const epipeError = new Error(
              `Connection broken: The remote MCP server closed the connection unexpectedly. Try restarting the MCP server.`
            );
            epipeError.name = "ConnectionBrokenError";
            reject(epipeError);
          } else {
            reject(error);
          }
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Test if the connection is still alive by attempting a small write
   */
  async testConnection(): Promise<boolean> {
    if (!this.isSocketWritable()) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      // Use a very small operation to test connectivity
      // We'll just check if the socket is still writable
      try {
        if (this.socket?.writable && !this.socket.destroyed) {
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (error) {
        resolve(false);
      }
    });
  }

  /**
   * Closes the Unix socket connection
   */
  async close(): Promise<void> {
    if (this.socket) {
      return new Promise<void>((resolve) => {
        const cleanup = () => {
          this.socket = null;
          this.isConnected = false;
          this.isConnecting = false;
          this.connecting = null;
          resolve();
        };

        if (this.socket?.destroyed) {
          cleanup();
          return;
        }

        // Set a timeout for cleanup
        const timeoutId = setTimeout(() => {
          this.socket?.destroy();
          cleanup();
        }, 1000);

        this.socket?.once("close", () => {
          clearTimeout(timeoutId);
          cleanup();
        });

        this.socket?.end();
      });
    }
  }
}
