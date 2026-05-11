import app from "./app";
import { logger } from "./lib/logger";

const mrs_port = Number(process.env.PORT) || 3000;

if (Number.isNaN(mrs_port) || mrs_port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const mrs_server = app.listen(mrs_port, "0.0.0.0", () => {
  logger.info({ port: mrs_port }, "Server listening on 0.0.0.0");
});

mrs_server.on("error", (mrs_err) => {
  logger.error({ err: mrs_err }, "Error listening on port");
  process.exit(1);
});