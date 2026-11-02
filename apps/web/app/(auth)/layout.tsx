import { ScanSearch } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/15%,transparent_60%)]"
      />
      <div className="flex items-center gap-2 text-xl font-semibold">
        <ScanSearch className="size-6 text-primary" aria-hidden />
        SiteScope
      </div>
      {children}
    </main>
  );
}
