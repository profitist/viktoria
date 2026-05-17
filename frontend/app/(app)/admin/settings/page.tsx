import { Suspense } from "react";
import SettingsPageClient from "./SettingsPageClient";

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageClient />
    </Suspense>
  );
}
