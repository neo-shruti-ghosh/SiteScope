import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditWorkspace } from "@/components/audit/audit-workspace";
import { hostOf } from "@/lib/format";
import { fetchAudit } from "@/lib/server-api";

export const generateMetadata = async ({ params }: PageProps<"/audits/[id]">): Promise<Metadata> => {
  const audit = await fetchAudit((await params).id);
  return { title: audit ? `Audit · ${hostOf(audit.url)}` : "Audit" };
};

export default async function AuditPage({ params }: PageProps<"/audits/[id]">) {
  const audit = await fetchAudit((await params).id);
  if (!audit) notFound();
  return <AuditWorkspace audit={audit} />;
}
