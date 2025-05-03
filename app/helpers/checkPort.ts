export async function isPortFree(port: number) {
  if (port) {
    const isPortInUse = await new Promise((resolve) => {
      const net = require("net");
      const server = net.createServer();

      server.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      server.once("listening", () => {
        server.close();
        resolve(false);
      });

      server.listen(port);
    });

    if (isPortInUse) {
      return false;
    }

    return true;
  }
}
