import { WsProvider } from "@/contexts/WsContext";
import Sidebar from "@/components/sidebar/Sidebar";
import EventLogPanel from "@/components/event-log/EventLogPanel";

// WsProvider и дочерние компоненты — клиентские,
// но сам layout — Server Component: импорт клиентских компонентов разрешён.

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WsProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <EventLogPanel />
      </div>
    </WsProvider>
  );
}
