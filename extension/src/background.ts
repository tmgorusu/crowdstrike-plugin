import type { AssistRequest, AssistResponse, ExtensionMessage, ExtensionReply } from "../../shared/contract";
import { localServerSource } from "./guidance/localSource";
import { createGuidanceService } from "./guidance/service";
import type { GuidanceMessage } from "./guidance/types";

// The service worker is the only part of the extension that talks to the backend, so the
// content script never needs network access and no API key ever ships in extension code.

const DEFAULT_API = "http://localhost:3000";
const apiBase = async () => ((await chrome.storage.local.get("apiBase")).apiBase as string | undefined) || DEFAULT_API;

async function call<T>(path: string, init?: RequestInit, timeoutMs = 40000): Promise<T> {
  const res = await fetch(`${await apiBase()}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `The assistant service returned ${res.status}.`);
  if (!body) throw new Error("The assistant service returned an empty response.");
  return body as T;
}

const guidance = createGuidanceService(localServerSource(apiBase));

async function handle(message: ExtensionMessage | GuidanceMessage): Promise<ExtensionReply<unknown>> {
  if (message.type === "guidance:field") return { ok: true, data: await guidance(message.payload) };
  try {
    if (message.type === "copilot:health") return { ok: true, data: await call<{ ok: boolean; ai: boolean }>("/api/copilot/assist", undefined, 5000) };
    if (message.type === "copilot:assist") {
      const data = await call<AssistResponse & { notice?: string }>("/api/copilot/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message.payload satisfies AssistRequest),
        credentials: "omit", // never forward cookies or sessions from the compliance site
      });
      if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("The assistant returned an empty answer.");
      return { ok: true, data };
    }
    return { ok: false, error: "Unknown request." };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const offline = /Failed to fetch|NetworkError|timed out|aborted|TimeoutError/i.test(msg);
    return { ok: false, error: offline ? "Can't reach the Strike assistant service. Start it with `npm start` and try again." : msg };
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage | GuidanceMessage, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  void handle(message).then(sendResponse);
  return true; // async response
});

// Toolbar click: open the assistant on any page the user chooses (activeTab), not just matched sites.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "copilot:toggle" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "copilot:toggle" }).catch(() => undefined);
  }
});
