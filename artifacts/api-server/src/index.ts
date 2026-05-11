import app from "./app";
import { logger } from "./lib/logger";

// Use a safe fallback for PORT so the process doesn't crash when PORT is absent.
// Prefer the environment value when present, otherwise default to 3000.
const port = Number(process.env.PORT) || 3000;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

app.listen(
  {
    port,
    host: "0.0.0.0",
  },
  (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  },
);