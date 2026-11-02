"use client";

import { NODES, type NodeId, PIPELINE_STAGES } from "@sitescope/shared";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { motion } from "motion/react";
import { Fragment } from "react";
import type { NodeStatus } from "@/lib/audit-stream";
import { cn } from "@/lib/utils";
import { NODE_ICONS } from "./icons";

const STATUS_LABEL: Record<NodeStatus, string> = {
  pending: "waiting",
  running: "running",
  done: "done",
  error: "failed",
};

function NodePill({ node, status }: { node: NodeId; status: NodeStatus }) {
  const Icon = NODE_ICONS[node];
  return (
    <motion.li
      layout
      className={cn(
        "relative flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors duration-500",
        status === "pending" && "border-dashed text-muted-foreground",
        status === "running" && "border-primary/60 bg-primary/8 text-foreground",
        status === "done" && "border-good/40 bg-good/8 text-foreground",
        status === "error" && "border-poor/50 bg-poor/8 text-foreground",
      )}
    >
      {status === "running" && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-xl ring-2 ring-primary/50"
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="whitespace-nowrap">{NODES[node].label}</span>
      <span className="ml-auto shrink-0">
        {status === "running" && <LoaderCircle className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden />}
        {status === "done" && <CircleCheck className="size-4 text-good" aria-hidden />}
        {status === "error" && <CircleX className="size-4 text-poor" aria-hidden />}
      </span>
      <span className="sr-only">: {STATUS_LABEL[status]}</span>
    </motion.li>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div aria-hidden className="relative mx-auto h-5 w-0.5 shrink-0 overflow-hidden rounded-full bg-border lg:mx-0 lg:h-0.5 lg:w-auto lg:min-w-4 lg:flex-1 lg:self-center">
      <motion.div
        className="absolute inset-0 origin-top bg-primary lg:origin-left"
        initial={false}
        animate={{ scaleY: active ? 1 : 0, scaleX: active ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
}

/** The LangGraph pipeline, left to right on desktop and top to bottom on small screens. Parallel nodes share a stage. */
export function Pipeline({ nodes }: { nodes: Record<NodeId, NodeStatus> }) {
  const stageDone = (stage: readonly NodeId[]) => stage.every((n) => nodes[n] === "done" || nodes[n] === "error");

  return (
    <div className="flex flex-col lg:flex-row lg:items-center">
      {PIPELINE_STAGES.map((stage, i) => (
        <Fragment key={stage.join()}>
          {i > 0 && <Connector active={stageDone(PIPELINE_STAGES[i - 1] ?? [])} />}
          <ol
            aria-label={stage.length > 1 ? "Parallel checks" : undefined}
            className={cn(
              "flex flex-col gap-2 lg:flex-none",
              stage.length > 1 && "grid sm:grid-cols-3 lg:flex lg:w-52 lg:flex-col",
            )}
          >
            {stage.map((node) => (
              <NodePill key={node} node={node} status={nodes[node]} />
            ))}
          </ol>
        </Fragment>
      ))}
    </div>
  );
}
