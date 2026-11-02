import { EventEmitter } from "node:events";
import { prisma, type Prisma } from "@sitescope/db";
import { type AuditEvent, AuditEventSchema } from "@sitescope/shared";

/** What a node passes to emit(); the bus fills in seq, auditId and ts. */
export type EmitInput = AuditEvent extends infer E
  ? E extends AuditEvent
    ? Omit<E, "seq" | "auditId" | "ts">
    : never
  : never;

export type Emit = (event: EmitInput) => Promise<AuditEvent>;

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export const subscribe = (auditId: string, listener: (event: AuditEvent) => void): (() => void) => {
  emitter.on(auditId, listener);
  return () => emitter.off(auditId, listener);
};

/**
 * Creates an emitter for one audit run. Events are numbered, persisted (so SSE clients can
 * replay after reconnecting) and broadcast in order, even when parallel nodes emit at once.
 */
export const createEmitter = async (auditId: string): Promise<Emit> => {
  const last = await prisma.auditEvent.findFirst({ where: { auditId }, orderBy: { seq: "desc" }, select: { seq: true } });
  let nextSeq = (last?.seq ?? -1) + 1;
  let chain: Promise<unknown> = Promise.resolve();

  return (input) => {
    const event = AuditEventSchema.parse({ ...input, seq: nextSeq++, auditId, ts: new Date().toISOString() });
    const persisted = chain.then(async () => {
      await prisma.auditEvent.create({
        data: {
          auditId,
          seq: event.seq,
          type: event.type,
          node: event.node ?? null,
          message: event.message,
          data: "data" in event && event.data ? (event.data as Prisma.InputJsonValue) : undefined,
        },
      });
      emitter.emit(auditId, event);
      return event;
    });
    chain = persisted.catch(() => undefined);
    return persisted;
  };
};

/** Rebuilds typed events from the database for replay. */
export const loadEvents = async (auditId: string, afterSeq: number): Promise<AuditEvent[]> => {
  const rows = await prisma.auditEvent.findMany({ where: { auditId, seq: { gt: afterSeq } }, orderBy: { seq: "asc" } });
  return rows.map((row) =>
    AuditEventSchema.parse({
      seq: row.seq,
      auditId: row.auditId,
      type: row.type,
      node: row.node ?? undefined,
      message: row.message,
      ts: row.createdAt.toISOString(),
      ...(row.data === null ? {} : { data: row.data }),
    }),
  );
};
