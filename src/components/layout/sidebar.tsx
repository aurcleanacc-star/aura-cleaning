"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { visibleSections, type NavItem } from "@/components/layout/nav-config";
import type { PermissionCode } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { AurcleanLogo } from "@/components/shared/aurclean-logo";

interface SidebarProps {
  permissions: PermissionCode[];
  open: boolean;
  onClose: () => void;
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function Sidebar({ permissions, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const sections = visibleSections(permissions);

  return (
    <>
      {open ? (
        <div
          className="animate-fade-in-soft fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#06261c] text-emerald-50 transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] lg:translate-x-0 border-r border-emerald-900/60 shadow-xl",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-emerald-900/60 px-4 bg-[#041d15]">
          <Link href="/dashboard" className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition-all duration-200 hover:opacity-90">
            <AurcleanLogo size="md" variant="full" showSubtitle subtitleText="LAUNDRY ERP" theme="dark" />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-emerald-300 hover:bg-emerald-900/60 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-3 py-4">
          {sections.map((section, index) => (
            <div key={section.label ?? `section-${index}`} className="space-y-1">
              {section.label ? (
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                  {section.label}
                </p>
              ) : null}
              <NavGroup items={section.items} pathname={pathname} onNavigate={onClose} />
            </div>
          ))}
        </nav>

        <div className="border-t border-emerald-900/60 px-4 py-3 bg-[#041d15]/50">
          <p className="text-[11px] font-medium text-emerald-300/70">
            AURCLEAN ERP · Connected Ledger
          </p>
        </div>
      </aside>
    </>
  );
}

function NavGroup({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                active
                  ? "bg-emerald-800/60 font-semibold text-white shadow-sm shadow-emerald-950/40"
                  : "text-emerald-100/70 hover:bg-emerald-900/40 hover:text-white hover:pl-3.5",
              )}
            >
              {active ? (
                <span
                  className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
                  aria-hidden
                />
              ) : null}
              <item.icon
                className={cn(
                  "size-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  active ? "text-emerald-400" : "text-emerald-200/60 group-hover:text-emerald-300",
                )}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
