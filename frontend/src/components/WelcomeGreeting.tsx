"use client";

import { useEffect, useState } from "react";
import { greetingName, greetingRole, greetingTimeWord } from "@/lib/constants";
import type { Me } from "@/lib/types";

export function WelcomeGreeting({ me }: { me: Me }) {
  const [timeWord, setTimeWord] = useState("Halo");

  useEffect(() => {
    // Deferred to the client on purpose - the server and the browser can disagree on local
    // time/hour, so this runs after hydration to avoid a mismatch warning (same reasoning as
    // AppShell's dateText).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeWord(greetingTimeWord());
  }, []);

  const name = greetingName(me);
  const role = greetingRole(me);

  return (
    <>
      <h3 className="welcome-heading">
        {timeWord}, <span className="welcome-name">{name}</span>
      </h3>
      {name !== role && <p className="welcome-role">{role}</p>}
    </>
  );
}
