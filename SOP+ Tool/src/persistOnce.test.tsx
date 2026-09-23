// @vitest-environment jsdom
/**
 * The SOP+ save used to run inside the state updater, which React may invoke more
 * than once for a single dispatch - every run sent another write. This pins the
 * replacement: the updater only records what to save (assigning a ref is
 * idempotent) and an effect performs the write once, after commit.
 *
 * StrictMode is the lever here: it deliberately double-invokes updaters, so it
 * reproduces the exact condition the old code was vulnerable to.
 */
import { describe, expect, it } from "vitest";
import { StrictMode, useEffect, useRef, useState, act } from "react";
import { createRoot } from "react-dom/client";

// Without this React refuses to treat act() as a real act scope, and StrictMode
// double-invocation is not exercised - the test would pass for the wrong reason.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function harness(onSave: (from: number, to: number) => void) {
  return function Widget() {
    const [value, setRaw] = useState(0);
    const pending = useRef<{ previous: number; next: number } | null>(null);
    const bump = () => setRaw((previous) => {
      const next = previous + 1;
      pending.current = { previous, next };   // idempotent: a repeat run rewrites the same pair
      return next;
    });
    useEffect(() => {
      const p = pending.current;
      if (!p) return;
      pending.current = null;
      onSave(p.previous, p.next);
    });
    return <button onClick={bump}>{value}</button>;
  };
}

/** The pattern that was there before: the write fired from inside the updater. */
function brokenHarness(onSave: (from: number, to: number) => void) {
  return function Widget() {
    const [value, setRaw] = useState(0);
    const bump = () => setRaw((previous) => {
      const next = previous + 1;
      onSave(previous, next);   // side effect inside the updater
      return next;
    });
    return <button onClick={bump}>{value}</button>;
  };
}

describe("SOP+ save pattern", () => {
  it("CONTROL: the old shape really does write twice, so this test can detect it", async () => {
    const saves: [number, number][] = [];
    const Widget = brokenHarness((from, to) => saves.push([from, to]));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<StrictMode><Widget /></StrictMode>); });
    const button = host.querySelector("button")!;
    await act(async () => { button.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(saves.length).toBeGreaterThan(1);
    await act(async () => { root.unmount(); });
  });

  it("writes once per change even when React runs the updater twice", async () => {
    const saves: [number, number][] = [];
    const Widget = harness((from, to) => saves.push([from, to]));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<StrictMode><Widget /></StrictMode>); });

    const button = host.querySelector("button")!;
    await act(async () => { button.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(saves).toEqual([[0, 1]]);           // exactly one write, not two

    await act(async () => { button.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(saves).toEqual([[0, 1], [1, 2]]);   // and one per subsequent change
    expect(button.textContent).toBe("2");      // state still advanced once per click

    await act(async () => { root.unmount(); });
  });
});
