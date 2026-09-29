"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MasterDataCategory, MasterDataItem } from "@/lib/types";

// Loads a Master Data category's current list once per mount - every dropdown fed from Super
// Admin's Master Data tab (Kategori, Tipe, Asuransi, Tahun, etc.) reads through this instead of a
// hardcoded label map, so a rename/add/delete there shows up everywhere without a redeploy.
export function useMasterDataItems(category: MasterDataCategory): MasterDataItem[] {
  const [items, setItems] = useState<MasterDataItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.listMasterData(category).then((res) => {
      if (!cancelled) setItems(res.items);
    }).catch(() => {
      if (!cancelled) setItems([]);
    });
    return () => {
      cancelled = true;
    };
  }, [category]);

  return items;
}

// Convenience wrapper for the common case: a SearchableSelect fed directly by Key, with Label
// only ever used for display.
export function useMasterDataOptions(category: MasterDataCategory) {
  const items = useMasterDataItems(category);
  const options = items.map((i) => i.key);
  const getLabel = (key: string) => items.find((i) => i.key === key)?.label ?? key;
  return { items, options, getLabel };
}
