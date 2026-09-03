"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-context";

// A menu row either navigates (href, rendered as a Link) or performs an action (onClick, rendered
// as a button) - the theme toggle is the latter, Profile/Contact Person the former. `active`
// highlights the row for whichever page is currently open. `disabled` renders the row inert (no
// navigation, no action) for a feature that's present in the menu but not wired up yet.
export interface NavItem {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  isSeparator?: boolean;
  disabled?: boolean;
}

export interface UserProfile {
  name: string;
  subtitle: string;
  avatarUrl?: string;
}

interface UserProfileSidebarProps {
  user: UserProfile;
  navItems: NavItem[];
  logoutItem: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const sidebarVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 22,
    },
  },
};

// This app doesn't load Tailwind's preflight (see tailwind.css) - it has its own hand-built base
// styles, so a plain <button>/<a> here would otherwise keep the browser's native chrome (outset
// border, grey background, underline) instead of the intended flat row. border-0/bg-transparent/
// no-underline/cursor-pointer/text-left are the reset preflight would normally have handled.
const rowClass =
  "group flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-3 py-2.5 text-left text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground";

// Floating profile/account menu panel: avatar+name header, a list of nav/action rows, and a
// destructive logout row - the shape a "who am I, where can I go, how do I leave" menu needs
// regardless of what app it's dropped into. Used as a dropdown panel here (see AppShell's
// AccountMenu), not a page-level <aside>, so the root is a plain motion.div rather than a
// landmark element.
export const UserProfileSidebar = React.forwardRef<HTMLDivElement, UserProfileSidebarProps>(
  ({ user, navItems, logoutItem, className }, ref) => {
    const { t } = useLanguage();
    return (
      <motion.div
        ref={ref}
        className={cn(
          "flex w-full max-w-xs flex-col rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg",
          className
        )}
        initial="hidden"
        animate="visible"
        variants={sidebarVariants}
        aria-label={t("nav.accountMenu")}
      >
        {/* User info header */}
        <motion.div variants={itemVariants} className="flex items-center gap-3 p-2">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg>
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="truncate text-sm text-muted-foreground">{user.subtitle}</span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="my-2 border-t border-border" />

        {/* Nav / action rows */}
        <nav className="flex flex-col gap-1" role="navigation">
          {navItems.map((item, index) => (
            <React.Fragment key={index}>
              {item.isSeparator && <motion.div variants={itemVariants} className="h-2" />}
              <motion.div variants={itemVariants}>
                {item.disabled ? (
                  <div className={cn(rowClass, "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground")}>
                    <span className="mr-3 h-5 w-5">{item.icon}</span>
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs font-normal">{t("nav.comingSoon")}</span>
                  </div>
                ) : item.href ? (
                  <Link href={item.href} className={cn(rowClass, item.active && "bg-accent text-accent-foreground")}>
                    <span className="mr-3 h-5 w-5">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <button type="button" onClick={item.onClick} className={cn(rowClass, item.active && "bg-accent text-accent-foreground")}>
                    <span className="mr-3 h-5 w-5">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )}
              </motion.div>
            </React.Fragment>
          ))}
        </nav>

        {/* Logout */}
        <motion.div variants={itemVariants} className="mt-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={logoutItem.onClick}
            className="group flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <span className="mr-3 h-5 w-5">{logoutItem.icon}</span>
            <span>{logoutItem.label}</span>
          </button>
        </motion.div>
      </motion.div>
    );
  }
);

UserProfileSidebar.displayName = "UserProfileSidebar";
