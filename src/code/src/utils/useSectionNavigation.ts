import { useCallback, useEffect, useState } from "react";
import type { TabType } from "../types";
const sections: TabType[] = [
  "home",
  "map",
  "matches",
  "messages",
  "notifications",
  "profile",
];
const read = (): TabType => {
  const value = new URL(window.location.href).searchParams.get(
    "section",
  ) as TabType;
  return sections.includes(value) ? value : "home";
};
export function useSectionNavigation() {
  const [active, setActive] = useState<TabType>(read);
  useEffect(() => {
    const back = () => setActive(read());
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const navigate = useCallback((tab: TabType) => {
    if (!sections.includes(tab)) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") !== tab) {
      url.searchParams.set("section", tab);
      window.history.pushState(null, "", url);
    }
    setActive(tab);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new window.Event("resize"));
    const main = document.querySelector(".app-main");
    if (
      main?.animate &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      const animation = main.animate(
        [
          { opacity: 0.25, transform: "translateY(5px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 220, easing: "ease-out" },
      );
      return () => animation.cancel();
    }
  }, [active]);
  return [active, navigate] as const;
}
