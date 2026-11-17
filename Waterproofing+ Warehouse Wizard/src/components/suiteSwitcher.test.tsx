// @vitest-environment jsdom
/**
 * Crew+ and SOP+ are held shut by `crew_config.crew_plus_live` /
 * `sop_plus_live`, so a crew member who followed either link out of Warehouse
 * Wizard landed on "Crew+ is not open yet". The client asked for the links to
 * be hidden instead, so the crew only see the app they are meant to be in.
 *
 * The failure this guards against is the quiet one: a later refactor dropping
 * the `showOtherApps` prop at the call site restores the default of `true` and
 * silently puts both links back in front of the crew, with nothing on screen
 * to say so. So this asserts on the rendered anchors, not on the prop.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SuiteSwitcher } from "./SuiteSwitcher";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const render = (element: React.ReactElement) => {
  act(() => { root.render(element); });
  return Array.from(host.querySelectorAll("a, span.active")).map((node) => node.textContent);
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => { root.unmount(); });
  host.remove();
});

describe("the Van Isle suite switcher", () => {
  it("shows a crew member only the app they are in", () => {
    expect(render(<SuiteSwitcher current="warehouse" showOtherApps={false} />)).toEqual(["Warehouse"]);
  });

  it("offers no way out of Warehouse Wizard for a crew member", () => {
    render(<SuiteSwitcher current="warehouse" showOtherApps={false} />);
    expect(host.querySelectorAll("a")).toHaveLength(0);
  });

  it("still gives a manager or admin all three", () => {
    expect(render(<SuiteSwitcher current="warehouse" showOtherApps />)).toEqual(["Crew+", "Warehouse", "SOP+"]);
  });

  it("marks the current app rather than linking to it", () => {
    render(<SuiteSwitcher current="warehouse" showOtherApps />);
    expect(host.querySelector("span.active")?.textContent).toBe("Warehouse");
    expect(Array.from(host.querySelectorAll("a")).map((a) => a.textContent)).toEqual(["Crew+", "SOP+"]);
  });
});
