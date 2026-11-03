import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { CSS } from "./ui/styles";

// Mounts the assistant inside a closed-off shadow root so the host page's CSS can't reach it
// and ours can't leak out. The host element itself takes no space and no clicks.

declare global { interface Window { __strikeCopilot?: { toggle: () => void } } }

if (!window.__strikeCopilot && window.top === window) {
  const host = document.createElement("strike-copilot");
  host.style.cssText = "all: initial; position: fixed; inset: auto 0 0 auto; width: 0; height: 0; z-index: 2147483000;";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const mount = document.createElement("div");
  shadow.append(style, mount);
  document.documentElement.append(host);

  const listeners = new Set<() => void>();
  window.__strikeCopilot = { toggle: () => listeners.forEach((l) => l()) };
  createRoot(mount).render(<App host={host} onToggleRequest={(fn) => { listeners.add(fn); return () => listeners.delete(fn); }} />);

  chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
    if (msg?.type === "copilot:toggle") window.__strikeCopilot?.toggle();
  });
}
