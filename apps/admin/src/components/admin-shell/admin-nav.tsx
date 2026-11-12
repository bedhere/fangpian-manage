"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavigationItem } from "./navigation";

function isActive(href: string, pathname: string | null) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ items }: { items: AdminNavigationItem[] }) {
  const pathname = usePathname();
  return <nav className="admin-shell__nav" aria-label="后台导航">
    {items.map((item) => <Link key={item.id} href={item.href} aria-current={isActive(item.href, pathname) ? "page" : undefined}>{item.label}</Link>)}
  </nav>;
}
