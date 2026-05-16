"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// =============================================================================
// Типы
// =============================================================================

interface NavItemProps {
  href: string;
  label: string;
}

// =============================================================================
// NavItem
// =============================================================================

function NavItem({ href, label }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}?`);

  const baseClasses =
    "flex items-center gap-3 px-3 py-2 rounded-md text-gray-400 text-sm hover:bg-gray-800 hover:text-white transition-colors";
  const activeClasses = "bg-gray-800 text-white";

  return (
    <Link href={href} className={isActive ? `${baseClasses} ${activeClasses}` : baseClasses}>
      {label}
    </Link>
  );
}

// =============================================================================
// Sidebar
// =============================================================================

export default function Sidebar() {
  return (
    <aside className="w-56 h-full bg-gray-900 flex flex-col flex-shrink-0">
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="text-white font-semibold text-sm truncate block">
          Workspace
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem href="/board"    label="Board"    />
        <NavItem href="/admin"    label="Admin"    />
        <NavItem href="/ai-groom" label="AI Groom" />
      </nav>
    </aside>
  );
}
