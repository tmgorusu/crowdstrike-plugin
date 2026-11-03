import { useCallback, useEffect, useRef, useState } from "react";
import { fieldIdOf, scanPage, type ScanResult } from "./scanner";

/** Live scan of the page: rescans on DOM changes (debounced) and tracks the field in focus. */
export function useScan(host: HTMLElement) {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [focusId, setFocusId] = useState<string>();
  const scanRef = useRef<ScanResult | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const rescan = useCallback(() => {
    const next = scanPage(host);
    scanRef.current = next;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __strikeScan: ScanResult }).__strikeScan = next;
    setScan(next);
    return next;
  }, [host]);

  useEffect(() => {
    rescan();
    const schedule = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(rescan, 350); };
    const observer = new MutationObserver((records) => {
      if (records.some((r) => !host.contains(r.target))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style", "class", "aria-hidden", "aria-invalid", "disabled", "required"] });
    const onInput = (e: Event) => { if (!host.contains(e.target as Node)) schedule(); };
    const onFocus = (e: FocusEvent) => {
      if (host.contains(e.target as Node)) return;
      const id = fieldIdOf(e.target, scanRef.current) ?? fieldIdOf(e.target, rescan());
      if (id) setFocusId(id);
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("focusin", onFocus, true);
    window.addEventListener("popstate", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer.current);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("focusin", onFocus, true);
      window.removeEventListener("popstate", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [host, rescan]);

  const current = useCallback(() => scanRef.current, []);
  return { scan, rescan, current, focusId, setFocusId };
}
