"use client";

import { AuditEventSchema, TERMINAL_EVENTS } from "@sitescope/shared";
import { useEffect, useReducer } from "react";
import { auditEventsUrl } from "@/lib/api";
import { initialStreamState, streamReducer } from "@/lib/audit-stream";

/** Subscribes to an audit's SSE stream and folds events into UI state. */
export const useAuditStream = (auditId: string) => {
  const [state, dispatch] = useReducer(streamReducer, undefined, initialStreamState);

  useEffect(() => {
    const source = new EventSource(auditEventsUrl(auditId), { withCredentials: true });

    source.onmessage = (message: MessageEvent<string>) => {
      const parsed = AuditEventSchema.safeParse(JSON.parse(message.data));
      if (!parsed.success) return;
      dispatch({ kind: "event", event: parsed.data });
      // The server ends the stream here; close so EventSource doesn't auto-reconnect.
      if (TERMINAL_EVENTS.includes(parsed.data.type)) source.close();
    };
    // EventSource retries on its own (sending Last-Event-ID); just reflect it in the UI.
    source.onerror = () => dispatch({ kind: "reconnecting" });

    return () => source.close();
  }, [auditId]);

  return state;
};
