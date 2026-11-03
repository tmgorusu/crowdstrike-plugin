// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchFieldActivity } from "../extension/src/content/triggers";

let stop: () => void;
let calls: [string, string][];

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = `<form>
    <input id="name"><input id="email">
    <select id="type"><option>A</option><option>B</option></select>
    <input id="ok" type="checkbox"><input id="other" class="untracked">
  </form><div id="host"><input id="inside"></div>`;
  calls = [];
  const tracked = new Set(["name", "email", "type", "ok", "inside"]);
  stop = watchFieldActivity({
    host: document.getElementById("host")!,
    resolve: (t) => (t instanceof HTMLElement && tracked.has(t.id) ? t.id : undefined),
    onTrigger: (id, reason) => calls.push([id, reason]),
  });
});
afterEach(() => { stop(); vi.useRealTimers(); });

const el = (id: string) => document.getElementById(id)!;
const fire = (id: string, type: string) => el(id).dispatchEvent(new Event(type, { bubbles: true }));
const focus = (id: string) => el(id).dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
const blur = (id: string) => el(id).dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

describe("field activity triggers", () => {
  it("waits for a pause in typing before asking", () => {
    for (let i = 0; i < 10; i++) { fire("name", "input"); vi.advanceTimersByTime(100); }
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(700);
    expect(calls).toEqual([["name", "input"]]);
  });

  it("asks shortly after focus, but not for fields the user only tabs through", () => {
    focus("name"); blur("name");
    focus("email");
    vi.advanceTimersByTime(200);
    expect(calls).toEqual([["email", "focus"]]);
  });

  it("asks right away on a committed change and drops pending typing", () => {
    fire("name", "input");
    fire("name", "change");
    vi.advanceTimersByTime(1000);
    expect(calls).toEqual([["name", "commit"]]);
  });

  it("treats selects and checkboxes as committed immediately", () => {
    fire("type", "input"); fire("type", "change");
    fire("ok", "input"); fire("ok", "change");
    vi.advanceTimersByTime(1000);
    expect(calls).toEqual([["type", "commit"], ["ok", "commit"]]);
  });

  it("flushes unfinished typing when the user leaves the field", () => {
    fire("name", "input");
    blur("name");
    expect(calls).toEqual([["name", "commit"]]);
  });

  it("ignores untracked inputs and the assistant's own UI", () => {
    fire("other", "input"); fire("inside", "input"); focus("inside"); fire("inside", "change");
    vi.advanceTimersByTime(1000);
    expect(calls).toEqual([]);
  });

  it("stops listening when disposed", () => {
    stop();
    fire("name", "change");
    expect(calls).toEqual([]);
  });
});
