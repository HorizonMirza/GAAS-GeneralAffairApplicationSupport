"use client";

import ContactInfoCardGrid from "@/components/ui/info-card";
import { CONTACT_PERSONS } from "@/lib/constants";

export default function ContactPersonPage() {
  return <ContactInfoCardGrid people={CONTACT_PERSONS} />;
}
