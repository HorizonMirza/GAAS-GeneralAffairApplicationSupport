"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AppSettings } from "@/lib/types";

// Loads the company name/logo once per mount - the sidebar, login page and Super Admin's own
// settings tab all read through this instead of the hardcoded "PGN Solution" name/logo file that
// used to be baked into the frontend, so a rename/re-upload there shows up everywhere without a
// redeploy. GET /api/app-settings is public (see AppSettingsController) so this works pre-login.
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getAppSettings().then((res) => {
      if (!cancelled) setSettings(res);
    }).catch(() => {
      if (!cancelled) setSettings(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const companyName = settings?.companyName ?? "PGN Solution";
  // updatedAt cache-busts appLogoUrl so a fresh upload/revert shows immediately instead of the
  // browser's cached copy of the previous logo at the same URL.
  const logoUrl = api.appLogoUrl(settings?.updatedAt);

  return { settings, companyName, logoUrl };
}

// Room/Vehicle Booking's date pickers feed this into DateFilterPicker's disabledDates prop so a
// holiday renders muted/unclickable up front instead of only failing after submit - the backend
// (AppSettingsCache.IsHoliday) still rejects it regardless, this is purely UX.
export function useHolidayDates(): string[] {
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.listHolidays().then((res) => {
      if (!cancelled) setDates(res.holidays.map((h) => h.date));
    }).catch(() => {
      if (!cancelled) setDates([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return dates;
}
