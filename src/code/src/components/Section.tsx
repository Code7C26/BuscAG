import React, { useRef } from "react";
/** Mount on first visit and retain drafts, filters and the Leaflet instance. */
export function Section({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const visited = useRef(false);
  if (active) visited.current = true;
  return visited.current ? (
    <section hidden={!active} aria-hidden={!active}>
      {children}
    </section>
  ) : null;
}
