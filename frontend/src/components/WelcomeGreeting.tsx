"use client";

import { useEffect, useState } from "react";
import { greetingName, greetingTimeWord } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Me } from "@/lib/types";

export function WelcomeGreeting({ me }: { me: Me }) {
  const { language } = useLanguage();
  const [timeWord, setTimeWord] = useState("");

  useEffect(() => {
    // Deferred to the client on purpose - the server and the browser can disagree on local
    // time/hour, so this runs after hydration to avoid a mismatch warning (same reasoning as
    // AppShell's dateText).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeWord(greetingTimeWord(language));
  }, [language]);

  return (
    <h3 className="welcome-heading">
      {timeWord}, <span className="welcome-name">{greetingName(me, language)}</span>
    </h3>
  );
}
