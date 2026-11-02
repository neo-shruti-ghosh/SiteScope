import {
  type AuditEvent,
  CATEGORY_IDS,
  type CategoryId,
  type CategoryResult,
  NODE_IDS,
  NODES,
  type NodeId,
} from "@sitescope/shared";

export type NodeStatus = "pending" | "running" | "done" | "error";

export type Chip =
  | { state: "pending" }
  | { state: "scanning" }
  | { state: "done"; score: number | null; status: CategoryResult["status"] };

export interface StreamState {
  status: "connecting" | "running" | "completed" | "failed";
  nodes: Record<NodeId, NodeStatus>;
  chips: Record<CategoryId, Chip>;
  /** Newest first, capped so long runs stay cheap to render. */
  feed: AuditEvent[];
  screenshots: { width: number; url: string }[];
  overall: { score: number | null; grade: string | null } | null;
  failure: string | null;
  lastSeq: number;
}

export type StreamAction = { kind: "event"; event: AuditEvent } | { kind: "reconnecting" };

// A full run emits ~50–80 events; keep them all so a finished audit shows its complete log.
const FEED_LIMIT = 200;

const fromEntries = <K extends string, V>(keys: readonly K[], value: V) =>
  Object.fromEntries(keys.map((k) => [k, value])) as Record<K, V>;

export const initialStreamState = (): StreamState => ({
  status: "connecting",
  nodes: fromEntries(NODE_IDS, "pending" as NodeStatus),
  chips: fromEntries(CATEGORY_IDS, { state: "pending" } as Chip),
  feed: [],
  screenshots: [],
  overall: null,
  failure: null,
  lastSeq: -1,
});

const startScanning = (chips: StreamState["chips"], node: NodeId): StreamState["chips"] => ({
  ...chips,
  ...Object.fromEntries(
    NODES[node].categories.filter((c) => chips[c].state === "pending").map((c) => [c, { state: "scanning" }]),
  ),
});

const applyEvent = (state: StreamState, event: AuditEvent): StreamState => {
  switch (event.type) {
    case "node_started":
      return event.node
        ? { ...state, nodes: { ...state.nodes, [event.node]: "running" }, chips: startScanning(state.chips, event.node) }
        : state;
    case "node_completed":
      return event.node && state.nodes[event.node] !== "error"
        ? { ...state, nodes: { ...state.nodes, [event.node]: "done" } }
        : state;
    case "error":
      return event.node && event.data?.recoverable === false
        ? { ...state, nodes: { ...state.nodes, [event.node]: "error" } }
        : state;
    case "category_result":
      return {
        ...state,
        chips: { ...state.chips, [event.data.category]: { state: "done", score: event.data.score, status: event.data.status } },
      };
    case "screenshot":
      return { ...state, screenshots: [...state.screenshots, event.data] };
    case "audit_completed":
      return { ...state, status: "completed", overall: { score: event.data.overallScore, grade: event.data.grade } };
    case "audit_failed":
      return { ...state, status: "failed", failure: event.message };
    default:
      return state;
  }
};

export const streamReducer = (state: StreamState, action: StreamAction): StreamState => {
  if (action.kind === "reconnecting") return state.status === "running" ? { ...state, status: "connecting" } : state;

  const { event } = action;
  // Replays after a reconnect can repeat events; seq makes them idempotent.
  if (event.seq <= state.lastSeq) return state;

  const next = applyEvent(state, event);
  return {
    ...next,
    status: next.status === "connecting" ? "running" : next.status,
    feed: [event, ...state.feed].slice(0, FEED_LIMIT),
    lastSeq: event.seq,
  };
};
