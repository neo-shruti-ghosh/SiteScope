import { type AuditEvent, TERMINAL_EVENTS } from "@sitescope/shared";
import { Router } from "express";
import { loadEvents, subscribe } from "../events/bus";
import { userIdOf } from "../middleware/auth";
import { findOwnedAudit } from "./audits";

export const eventsRouter = Router({ mergeParams: true });

const HEARTBEAT_MS = 15_000;

const parseLastSeq = (value: unknown): number => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : -1;
};

/**
 * Server-Sent Events: replays stored events after Last-Event-ID (or ?after=), then streams live.
 * The stream closes after audit_completed / audit_failed.
 */
eventsRouter.get("/:id/events", async (req, res) => {
  const audit = await findOwnedAudit(req.params.id, userIdOf(req));
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let lastSent = parseLastSeq(req.get("Last-Event-ID") ?? req.query.after);
  let closed = false;
  let unsubscribe = () => {};

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  };

  const send = (event: AuditEvent) => {
    if (closed || event.seq <= lastSent) return;
    lastSent = event.seq;
    res.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
    if (TERMINAL_EVENTS.includes(event.type)) close();
  };

  const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
  req.on("close", close);

  // Subscribe before replaying so nothing emitted in between is lost; `send` drops duplicates by seq.
  const buffered: AuditEvent[] = [];
  let replaying = true;
  unsubscribe = subscribe(audit.id, (event) => (replaying ? buffered.push(event) : send(event)));

  (await loadEvents(audit.id, lastSent)).forEach(send);
  buffered.forEach(send);
  replaying = false;

  // Finished, and the client already had the terminal event from an earlier connection: nothing left to stream.
  const fresh = closed ? null : await findOwnedAudit(audit.id, userIdOf(req));
  if (fresh?.status === "COMPLETED" || fresh?.status === "FAILED") close();
});
