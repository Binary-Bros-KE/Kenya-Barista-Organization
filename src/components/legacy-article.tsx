"use client";
import { publicArticleHtml } from "@/lib/public-photo";
import { useEffect, useId, useRef } from "react";
export function LegacyArticle({ html }: { html: string }) {
  const root = useRef<HTMLDivElement>(null), prefix = useId();
  useEffect(() => {
    const cleanup: (() => void)[] = [];
    root.current?.querySelectorAll<HTMLElement>("[data-legacy-tabs]").forEach((bar, group) => {
      const panels = bar.nextElementSibling;
      if (!panels?.hasAttribute("data-legacy-panels")) return;
      const buttons = [...bar.querySelectorAll<HTMLButtonElement>("button")], sections = [...panels.children] as HTMLElement[];
      if (buttons.length !== sections.length) return;
      bar.setAttribute("role", "tablist"); bar.setAttribute("aria-label", "Coffee guide sections");
      function select(index: number) { buttons.forEach((button, i) => { button.setAttribute("aria-selected", String(i === index)); button.tabIndex = i === index ? 0 : -1; if (sections[i]) sections[i].hidden = i !== index; }); }
      buttons.forEach((button, i) => {
        button.id = `${prefix}-${group}-tab-${i}`; sections[i].id = `${prefix}-${group}-panel-${i}`;
        button.setAttribute("role", "tab"); button.setAttribute("aria-controls", sections[i].id);
        sections[i].setAttribute("role", "tabpanel"); sections[i].setAttribute("aria-labelledby", button.id);
        const click = () => select(i), key = (event: KeyboardEvent) => { const target = event.key === "ArrowRight" ? (i + 1) % buttons.length : event.key === "ArrowLeft" ? (i + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : null; if (target !== null) { event.preventDefault(); select(target); buttons[target].focus(); } };
        button.addEventListener("click", click); button.addEventListener("keydown", key);
        cleanup.push(() => { button.removeEventListener("click", click); button.removeEventListener("keydown", key); });
      }); select(0);
    }); return () => cleanup.forEach(fn => fn());
  }, [html, prefix]);
  // Only reviewed, build-time HTML recovered from the owner's archive is passed here.
  return <div ref={root} className="legacy-article" dangerouslySetInnerHTML={{ __html: publicArticleHtml(html) }} />;
}
