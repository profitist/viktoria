"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItemProps {
  href: string;
  label: string;
}

function NavItem({ href, label }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}?`);

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all relative"
      style={{
        color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
        background: isActive ? "#161616" : "transparent",
        borderLeft: isActive ? "2px solid #3B82F6" : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "#161616";
          e.currentTarget.style.color = "rgba(255,255,255,0.72)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "rgba(255,255,255,0.45)";
        }
      }}
    >
      {label}
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside
      className="w-[220px] h-full flex flex-col flex-shrink-0"
      style={{
        background: "#0B0B0B",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="px-4 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span
          className="text-xs uppercase tracking-[0.2em] block"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          VIKTORIA
        </span>
        <span className="text-sm font-medium text-white truncate block mt-1">
          Workspace
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <NavItem href="/board" label="Board" />
        <NavItem href="/admin" label="Admin" />
        <NavItem href="/ai-groom" label="AI Groom" />
      </nav>
    </aside>
  );
}
