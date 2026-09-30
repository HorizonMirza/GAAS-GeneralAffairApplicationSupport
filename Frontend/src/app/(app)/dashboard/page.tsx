"use client";

import DashboardContent from "@/components/DashboardContent";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { me } = useAuth();
  if (!me) return null;
  return <DashboardContent me={me} />;
}
