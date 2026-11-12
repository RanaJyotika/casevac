"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const vertical = orientation === "vertical";
  return (
    <ul className={vertical ? "flex flex-col gap-0.5" : "flex gap-1 overflow-x-auto pb-1"}>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-2.5 rounded-md px-3 text-sm ${
                active ? "bg-brand-soft font-semibold text-brand-hover" : "font-medium text-ink-2 hover:bg-canvas"
              }`}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
