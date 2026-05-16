import { Suspense } from "react";

import AppShell from "./AppShell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace_id") ?? undefined;

  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
