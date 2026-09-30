import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui helper: merges conditional class lists (clsx) and resolves conflicting
// Tailwind utility classes so the last one wins (twMerge), e.g. cn("p-2", condition && "p-4").
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
