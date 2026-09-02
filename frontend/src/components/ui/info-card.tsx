"use client";

import { Clock, Mail } from "lucide-react";
import { CONTACT_WORKING_HOURS, type ContactPerson } from "@/lib/constants";

// wa.me needs digits only, already carrying the country code (62...) - the phone numbers in
// CONTACT_PERSONS are entered as "+62 812-1555-6739" for readability, so + / spaces / dashes are
// stripped rather than re-typing every number in wa.me's format.
function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

// Vibrant solid background per person for the placeholder avatar - a plain single pastel would
// look flat compared to the real photos this is standing in for, so each person gets a distinct
// color like they will once a real photo is dropped in. Assigned by list position (cycling
// through the palette) rather than hashing the name - with only a handful of people, a hash
// clusters several of them onto the same color by chance, while position guarantees each of the
// first N people (N = palette length) gets a color no one else has.
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-slate-700",
];

interface ContactInfoCardProps {
  person: ContactPerson;
  colorIndex: number;
}

// Adapted from a neumorphic "animated profile card" design - the shape (avatar, status dot, tag
// row, two round action buttons, hover lift) is kept, but every field is re-mapped to what a
// support-contact directory actually has: modules replace generic tags, and the status dot marks
// an active assigned PIC rather than fabricated live presence. There's no follower count
// equivalent for an internal contact, so it's dropped rather than inventing a number.
export function ContactInfoCard({ person, colorIndex }: ContactInfoCardProps) {
  const avatarColor = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-gray-800 shadow-[12px_12px_24px_rgba(0,0,0,0.15),-12px_-12px_24px_rgba(255,255,255,0.9)] dark:shadow-[12px_12px_24px_rgba(0,0,0,0.3),-12px_-12px_24px_rgba(255,255,255,0.1)] transition-[box-shadow] duration-300 ease-out hover:shadow-[0_0_0_1px_rgba(59,130,246,0.5),0_0_32px_8px_rgba(59,130,246,0.35),20px_20px_40px_rgba(0,0,0,0.2),-20px_-20px_40px_rgba(255,255,255,1)] dark:hover:shadow-[0_0_0_1px_rgba(96,165,250,0.6),0_0_32px_8px_rgba(96,165,250,0.35),20px_20px_40px_rgba(0,0,0,0.4),-20px_-20px_40px_rgba(255,255,255,0.15)]">
      {/* Cover banner - LinkedIn-style cover strip behind the avatar, in the app's own blue
          gradient (same tokens as the Profile page hero banner). */}
      <div className="h-20 bg-gradient-to-br from-blue-600 to-blue-400" aria-hidden="true" />

      {/* Status indicator - marks an active assigned PIC (every listed person currently is one),
          not real-time presence: there is no login/presence tracking behind this list. */}
      <div className="absolute right-4 top-4 z-10">
        <div className="relative" title="PIC aktif" aria-label="PIC aktif">
          <div className="h-3 w-3 rounded-full border-2 border-white bg-green-500 transition-transform duration-300 ease-out group-hover:scale-125 group-hover:shadow-[0_0_20px_rgba(34,197,94,0.6)]" />
          <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-500 animate-ping opacity-30" />
        </div>
      </div>

      <div className="px-5 pb-5">
        {/* Placeholder avatar (real photos not wired up yet) - a glossy solid-color sphere (radial
            highlight top-left, soft shadow bottom-right, plus a blurred highlight streak) topped
            with a generic person icon, standing in for a real headshot until one is dropped in.
            Pulled up to overlap the cover banner's bottom edge, LinkedIn-style. The blue ring is
            hidden at rest and only fades in on hover - the same one the real photos will keep. */}
        <div className="-mt-14 mb-6 flex justify-center relative z-10">
          <div className="relative">
            <div className="relative h-28 w-28 rounded-full p-1 bg-white dark:bg-gray-700 shadow-[inset_6px_6px_12px_rgba(0,0,0,0.1),inset_-6px_-6px_12px_rgba(255,255,255,0.9)] dark:shadow-[inset_6px_6px_12px_rgba(0,0,0,0.3),inset_-6px_-6px_12px_rgba(255,255,255,0.1)] transition-transform duration-300 ease-out group-hover:scale-110">
              <div className={`relative h-full w-full rounded-full overflow-hidden ${avatarColor}`}>
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_45%),radial-gradient(circle_at_70%_85%,rgba(0,0,0,0.3)_0%,rgba(0,0,0,0)_60%)]" />
                <div className="absolute -top-3 left-1/2 h-10 w-20 -translate-x-1/2 rounded-full bg-white/45 blur-md" />
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"></circle>
                    <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path>
                  </svg>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-blue-400 dark:border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out group-hover:animate-pulse" />
          </div>
        </div>

        {/* Name, phone, email - all grow and turn blue together on card hover. The role/module line
            was dropped since it just repeated the module tags shown right below. */}
        <div className="text-center relative z-10">
          <h3 className="leading-none text-lg font-semibold text-gray-900 dark:text-gray-100 transition-[transform,color] duration-300 ease-out group-hover:scale-110 group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {person.name}
          </h3>
          <p className="mt-1 leading-none text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums transition-[transform,color] duration-300 ease-out group-hover:scale-110 group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {person.phone}
          </p>
          <p className="mt-1 leading-none text-xs text-gray-400 dark:text-gray-500 break-all transition-[transform,color] duration-300 ease-out group-hover:scale-110 group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {person.email}
          </p>
        </div>

        {/* Office hours - shared across everyone (not a per-person fact), so it stays neutral
            gray and doesn't grow/turn blue on hover like the identity fields above. */}
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 relative z-10">
          <Clock className="h-3.5 w-3.5" />
          <span>{CONTACT_WORKING_HOURS}</span>
        </div>

        {/* Modules covered, as tags */}
        {person.modules.length > 0 && (
          <div className="mt-1.5 flex flex-wrap justify-center gap-2 relative z-10">
            {person.modules.map((m) => (
              <span
                key={m}
                className="inline-block rounded-full bg-white dark:bg-gray-700 px-3 py-1 text-xs font-medium shadow-[2px_2px_4px_rgba(0,0,0,0.05),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.2),-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-300 ease-out text-blue-600 dark:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:scale-105 group-hover:shadow-[0_0_10px_rgba(59,130,246,0.3)]"
              >
                {m}
              </span>
            ))}
          </div>
        )}

        {/* WhatsApp + Email - identical styling/interaction, only the icon differs. Color change is
            on the button's own :hover only (not group-hover) - hovering the card must not tint
            these, only hovering the button itself does. */}
        <div className="mt-3 flex gap-2 relative z-10">
          <a
            href={waLink(person.phone)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Chat WhatsApp ${person.name}`}
            className="flex-1 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.9)] dark:shadow-[6px_6px_12px_rgba(0,0,0,0.2),-6px_-6px_12px_rgba(255,255,255,0.1)] transition-[transform,box-shadow,background-color] duration-200 ease-out hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:shadow-[2px_2px_4px_rgba(0,0,0,0.05),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[2px_2px_4px_rgba(0,0,0,0.15),-2px_-2px_4px_rgba(255,255,255,0.05)] hover:scale-95 active:scale-90 active:duration-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.44 9.9-9.9C21.96 6.45 17.5 2 12.04 2Zm0 18.11h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.2 8.2 0 0 1-1.26-4.35c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.26.86 5.82 2.41a8.17 8.17 0 0 1 2.41 5.81c0 4.53-3.7 8.22-8.23 8.22Zm4.5-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01s-.43.06-.66.31c-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
            </svg>
          </a>
          <a
            href={`mailto:${person.email}`}
            aria-label={`Email ${person.name}`}
            className="flex-1 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.9)] dark:shadow-[6px_6px_12px_rgba(0,0,0,0.2),-6px_-6px_12px_rgba(255,255,255,0.1)] transition-[transform,box-shadow,background-color] duration-200 ease-out hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:shadow-[2px_2px_4px_rgba(0,0,0,0.05),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[2px_2px_4px_rgba(0,0,0,0.15),-2px_-2px_4px_rgba(255,255,255,0.05)] hover:scale-95 active:scale-90 active:duration-100"
          >
            <Mail className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

interface ContactInfoCardGridProps {
  people: ContactPerson[];
}

export default function ContactInfoCardGrid({ people }: ContactInfoCardGridProps) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 xl:gap-10">
      {people.map((person, index) => (
        <ContactInfoCard key={person.name} person={person} colorIndex={index} />
      ))}
    </div>
  );
}
