import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { env } from "./env";
import { requireUser } from "./middleware/auth";
import { auditsRouter } from "./routes/audits";
import { eventsRouter } from "./routes/events";
import { screenshotsRouter } from "./routes/screenshots";

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on our side." });
};

export const createApp = () =>
  express()
    .disable("x-powered-by")
    .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
    .use(express.json({ limit: "32kb" }))
    .get("/health", (_req, res) => {
      res.json({ ok: true });
    })
    .use("/api/audits", requireUser, eventsRouter, screenshotsRouter, auditsRouter)
    .use(errorHandler);
