"use client";

import ContactInfoCardGrid from "@/components/ui/info-card";
import { CONTACT_PERSONS } from "@/lib/constants";

// Placeholder photo until real ones exist - same convention as roomPhotoUrl in the Room Booking
// overview: filename is the person's name slugified, so swapping in a real photo later is just
// overwriting /public/assets/contacts/<slug>.png, no code change needed. ContactInfoCard falls
// back to an initial avatar if the file isn't there yet.
function contactPhotoUrl(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `/assets/contacts/${slug}.png`;
}

export default function ContactPersonPage() {
  return <ContactInfoCardGrid people={CONTACT_PERSONS} photoUrl={contactPhotoUrl} />;
}
