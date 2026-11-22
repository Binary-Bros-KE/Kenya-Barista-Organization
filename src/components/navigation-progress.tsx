"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLinkStatus } from "next/link";

// A thin bar across the top that starts the moment someone clicks a link to another page of the site and
// finishes when that page arrives, so a click never looks ignored.
export function NavigationProgress() {
  const pathname = usePathname(), search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timers = useRef<number[]>([]);
  const clear = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target && link.target !== "_self" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      clear(); setState("loading");
      // Never leave the bar hanging if a navigation is abandoned.
      timers.current.push(window.setTimeout(() => setState("idle"), 120000));
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The new page has arrived: fill the bar, then fade it out.
  useEffect(() => {
    setState(current => current === "loading" ? "done" : current);
    clear();
    timers.current.push(window.setTimeout(() => setState(current => current === "done" ? "idle" : current), 400));
  }, [pathname, search]);
  useEffect(() => clear, []);

  return <div className={`nav-progress is-${state}`} aria-hidden="true"><i /></div>;
}

// A small spinner inside a link while the page it opens is loading.
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="link-pending" role="status" aria-label="Loading" /> : null;
}
