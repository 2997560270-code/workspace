const http = require("node:http");
const next = require("next");

const hostname = "127.0.0.1";
const port = Number(process.env.PORT ?? 3100);
const app = next({ dev: false, hostname, port, dir: process.cwd() });
const handle = app.getRequestHandler();
let server;

async function shutdown(code = 0) {
  if (server) await new Promise((resolve) => server.close(resolve));
  await app.close();
  process.exit(code);
}

process.once("SIGINT", () => { void shutdown(0); });
process.once("SIGTERM", () => { void shutdown(0); });
process.once("uncaughtException", (error) => { console.error(error); void shutdown(1); });
process.once("unhandledRejection", (error) => { console.error(error); void shutdown(1); });

app.prepare().then(() => {
  server = http.createServer((request, response) => handle(request, response));
  server.listen(port, hostname, () => console.log(`Product Drill test server ready at http://${hostname}:${port}`));
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
