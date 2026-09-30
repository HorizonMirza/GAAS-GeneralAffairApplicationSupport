"use client";

import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import AppShell from "@/components/AppShell";
import ForcedPasswordChangeScreen from "@/components/ForcedPasswordChangeScreen";

// Split out from AppLayout itself so it can call useAuth() - that only works inside
// AuthProvider's own subtree, which AppLayout is rendering, not inside.
function AuthGate({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();

  // Blocks AppShell/children entirely - no nav, no page content - until a real password
  // replaces the one-time generated one (see UsersAdminController.Create/ResetPassword). `loading`
  // guards against a flash of this screen before the first `me` fetch resolves.
  if (!loading && me?.mustChangePassword) {
    return <ForcedPasswordChangeScreen />;
  }
  return <AppShell>{children}</AppShell>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthGate>{children}</AuthGate>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
