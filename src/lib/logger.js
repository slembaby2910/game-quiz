const pino = require("pino");

module.exports = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: ["req.headers.authorization", "req.body.password", "*.password"],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV !== "production" && process.env.LOG_LEVEL !== "silent"
      ? { target: "pino-pretty" }
      : undefined,
});