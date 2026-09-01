"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/constants";
import { formatLongDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useClickOutside } from "@/lib/useClickOutside";
import { ThemeToggle } from "@/components/ThemeToggle";
import ChatNotificationListener from "@/components/ChatNotificationListener";
import type { Role } from "@/lib/types";

interface NavLeaf {
  label: string;
  href: string;
  superAdminOnly?: boolean;
  roles?: Role[];
}

interface NavCategory {
  icon: ReactNode;
  label: string;
  items: NavLeaf[];
}

const EXPEDITION_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"></path><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>
);
const RUMAH_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.986L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path></svg>
);
const KENDARAAN_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h-2v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2"></path><path d="M9 17h6"></path><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle></svg>
);
const MEETING_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);
const SARANA_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"></path></svg>
);
const ARSIP_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>
);

const NAV_CATEGORIES: NavCategory[] = [
  {
    icon: EXPEDITION_ICON,
    label: "Expedition",
    items: [
      { label: "Overview", href: "/ekspedisi/overview" },
      { label: "Transaction", href: "/ekspedisi/transaksi" },
      { label: "Invoice", href: "/ekspedisi/invoice-history", roles: ["ADMIN_GA", "APPROVAL_GA", "KPU"] },
      { label: "Super Admin", href: "/superadmin", superAdminOnly: true },
    ],
  },
  {
    icon: MEETING_ICON,
    label: "Room Booking",
    items: [
      { label: "Overview", href: "/booking-ruang-meeting/overview" },
      { label: "Calendar", href: "/booking-ruang-meeting/calendar" },
      { label: "Booking", href: "/booking-ruang-meeting/transaksi" },
      // "Laporan" temporarily hidden from the nav while its design gets revisited - the page
      // itself and its API are left untouched so this is a one-line revert, not a rebuild.
      { label: "Super Admin", href: "/superadmin", superAdminOnly: true },
    ],
  },
  {
    icon: KENDARAAN_ICON,
    label: "Vehicle Booking",
    items: [
      { label: "Overview", href: "/booking-kendaraan/overview" },
      { label: "Calendar", href: "/booking-kendaraan/calendar" },
      { label: "Booking", href: "/booking-kendaraan/transaksi" },
      { label: "Super Admin", href: "/superadmin", superAdminOnly: true },
    ],
  },
  {
    icon: RUMAH_ICON,
    label: "Office Supplies",
    items: [
      { label: "Overview", href: "/office-supplies/overview" },
      { label: "Transaction", href: "/office-supplies/transaksi" },
      { label: "Super Admin", href: "/superadmin", superAdminOnly: true },
    ],
  },
  {
    icon: SARANA_ICON,
    label: "Maintenance",
    items: [
      { label: "Overview", href: "/maintenance/overview" },
      { label: "Transaction", href: "/maintenance/transaksi" },
      { label: "Super Admin", href: "/superadmin", superAdminOnly: true },
    ],
  },
  {
    icon: ARSIP_ICON,
    label: "Archive",
    items: [
      { label: "Dokumen", href: "/arsip" },
      { label: "Super Admin", href: "/superadmin", superAdminOnly: true },
    ],
  },
];

// KPU only deals with Expedition (final sign-off + invoices) - Dashboard and Profile are always
// shown regardless of role, so together that leaves Dashboard/Expedition/Profile as their whole
// sidebar.
const KPU_HIDDEN_CATEGORIES = new Set(["Room Booking", "Vehicle Booking", "Office Supplies", "Maintenance", "Archive"]);

function AccountMenu() {
  const { me } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside([menuRef], () => setOpen(false), open);

  if (!me) return null;

  async function handleLogout() {
    await api.logout();
    router.replace("/");
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        className="account-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="account-avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
        </span>
        <span className="account-info">
          <span className="name">{me.nama}</span>
          <span className="role">{ROLE_LABEL[me.role] || me.role}</span>
        </span>
        <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && (
        <div className="account-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="account-dropdown-header">
            <span className="account-avatar-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
            </span>
            <div>
              <div className="account-dropdown-name">{me.nama}</div>
              <div className="account-dropdown-email">{ROLE_LABEL[me.role] || me.role}</div>
            </div>
          </div>
          <hr className="account-dropdown-divider" />
          <button className="account-dropdown-logout" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [dateText, setDateText] = useState("");

  useEffect(() => {
    // Deferred to the client on purpose - the server and the browser can format "now" into a
    // different string (timezone), so this runs after hydration to avoid a mismatch warning.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateText(formatLongDate(new Date()));
  }, []);

  useEffect(() => {
    // Syncs the expanded sidebar category to the current route on every navigation - moving to a
    // page outside any category (Dashboard, Profile) or into a different one closes whatever was
    // previously expanded, instead of leaving it open. The user can still expand/collapse by hand
    // in between navigations, since this effect only re-runs when pathname changes.
    // superAdminOnly items all share the same /superadmin href, so they're excluded from this
    // match - otherwise every category would "match" on /superadmin and this would always pick
    // whichever one happens to be first in NAV_CATEGORIES.
    const active = NAV_CATEGORIES.find((cat) => cat.items.some((item) => !item.superAdminOnly && item.href === pathname));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenCategory(active ? active.label : null);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("auth-ready", !!me);
    return () => document.body.classList.remove("auth-ready");
  }, [me]);

  if (!me) {
    return <div className="app-shell" />;
  }

  const isSuperAdmin = me.role === "SUPER_ADMIN";

  let topbarTitle = "Dashboard";
  for (const cat of NAV_CATEGORIES) {
    const match = cat.items.find((item) => item.href === pathname);
    if (match) {
      topbarTitle = `${cat.label} → ${match.label}`;
      break;
    }
  }
  if (pathname === "/dashboard") topbarTitle = "Dashboard";
  if (pathname === "/profile") topbarTitle = "Profile";
  if (pathname === "/superadmin") topbarTitle = "Super Admin";

  return (
    <div className="app-shell">
      <ChatNotificationListener />
      <aside className={`sidebar ${sidebarOpen ? "sidebar-toggled" : ""}`}>
        <Link className="brand-logo-sidebar" href="/dashboard" aria-label="Ke Dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logo-pgm-solution.png"
            alt="PGM Solution"
            className="brand-logo-sidebar-img"
            style={{ maxWidth: 170, maxHeight: 52, width: "auto", height: "auto" }}
          />
        </Link>

        <Link className={`nav-link ${pathname === "/dashboard" ? "active" : ""}`} href="/dashboard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>
          Dashboard
        </Link>

        {NAV_CATEGORIES.filter((cat) => me.role !== "KPU" || !KPU_HIDDEN_CATEGORIES.has(cat.label)).map((cat) => {
          // Same exclusion as the pathname-watching effect above - the shared /superadmin href
          // must not count as "this category is active", or all 6 categories highlight/expand
          // together on that page.
          const hasActive = cat.items.some((item) => !item.superAdminOnly && item.href === pathname);
          const isOpen = openCategory === cat.label || hasActive;
          return (
            <div key={cat.label} className={`nav-category ${isOpen ? "open" : ""} ${hasActive ? "has-active" : ""}`}>
              <button
                type="button"
                className="nav-category-trigger"
                onClick={() => setOpenCategory((current) => (current === cat.label ? null : cat.label))}
              >
                {cat.icon}
                <span>{cat.label}</span>
                <svg className="nav-category-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
              <div className="nav-category-submenu">
                {cat.items.map((item) => {
                  if (item.superAdminOnly && !isSuperAdmin) return null;
                  if (!item.superAdminOnly && isSuperAdmin) return null;
                  if (item.roles && !item.roles.includes(me.role)) return null;
                  return (
                    <Link
                      key={item.label}
                      className={`nav-link ${pathname === item.href ? "active" : ""}`}
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="sidebar-divider"></div>
        <Link className={`nav-link ${pathname === "/profile" ? "active" : ""}`} href="/profile">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path></svg>
          Profile
        </Link>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop visible" onClick={() => setSidebarOpen(false)} />}

      <div className="main-content">
        <header className="topbar" onClick={() => setOpenCategory((c) => c)}>
          <div className="topbar-left">
            <button className="icon-btn" aria-label="Toggle navigasi" onClick={() => setSidebarOpen((v) => !v)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h2>{topbarTitle}</h2>
          </div>
          <div className="topbar-date">{dateText}</div>
          <div className="topbar-right" onClick={(e) => e.stopPropagation()}>
            <AccountMenu />
            <ThemeToggle />
          </div>
        </header>

        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}
