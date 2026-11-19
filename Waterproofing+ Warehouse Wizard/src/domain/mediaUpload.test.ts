/**
 * Ten photos on one daily log, reported by the client on 20 November.
 *
 * The evidence from production: his first log (19 Nov, 20:06:17) carries zero
 * `daily_log_media` rows after ten photos; the retry eight minutes later
 * carries one, written ten seconds after the log. So a single photo took about
 * ten seconds on site, ten of them ran one after another, and the app had
 * already said "submitted" - he closed it, and the queue died silently.
 *
 * These pin the three things that were wrong: more than one upload is in
 * flight, a failure is reported instead of lost, and progress is published so
 * the screen can say "still going" rather than claiming to be finished.
 */
import { describe, expect, it } from "vitest";
import { mediaUploadSummary, uploadAllMedia, type MediaUploadProgress } from "./mediaUpload";

/** An upload that resolves when released, so overlap can be observed. */
function gated() {
  const release: Array<() => void> = [];
  let inFlight = 0;
  let peak = 0;
  const upload = () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    return new Promise<void>((resolve) => release.push(() => { inFlight -= 1; resolve(); }));
  };
  return { upload, release, peak: () => peak, inFlight: () => inFlight };
}

describe("attaching several files", () => {
  it("runs more than one at a time, so ten photos do not take ten times as long", async () => {
    const gate = gated();
    const files = Array.from({ length: 10 }, (_, i) => `photo-${i}.jpg`);
    const run = uploadAllMedia(files, gate.upload, { concurrency: 3 });
    await Promise.resolve();
    expect(gate.inFlight()).toBe(3);
    // Let every worker through, releasing each new batch as it is picked up.
    let settled = false;
    void run.then(() => { settled = true; });
    for (let i = 0; i < 200 && !settled; i += 1) {
      while (gate.release.length) gate.release.shift()!();
      await Promise.resolve();
    }
    const { failures } = await run;
    expect(failures).toEqual([]);
    expect(gate.peak()).toBe(3);
  });

  it("never starts more workers than there are files", async () => {
    const gate = gated();
    const run = uploadAllMedia(["only.jpg"], gate.upload, { concurrency: 3 });
    await Promise.resolve();
    expect(gate.inFlight()).toBe(1);
    gate.release.shift()!();
    await run;
  });

  it("retries a file once before giving up on it", async () => {
    const tries: string[] = [];
    const { failures } = await uploadAllMedia(["a.jpg"], async (file) => {
      tries.push(file);
      if (tries.length < 2) throw new Error("network");
    });
    expect(tries).toEqual(["a.jpg", "a.jpg"]);
    expect(failures).toEqual([]);
  });

  it("reports the files that would not go up instead of losing them", async () => {
    const { failures } = await uploadAllMedia(["ok.jpg", "bad.jpg"], async (file) => {
      if (file === "bad.jpg") throw new Error("413 too large");
    }, { concurrency: 1 });
    expect(failures.map((item) => item.file)).toEqual(["bad.jpg"]);
    expect(failures[0].message).toBe("413 too large");
  });

  it("names failures in the order the person picked them, not the order they lost", async () => {
    const files = ["1.jpg", "2.jpg", "3.jpg", "4.jpg"];
    const { failures } = await uploadAllMedia(files, async (file) => {
      if (file === "1.jpg") { await new Promise((r) => setTimeout(r, 5)); throw new Error("slow fail"); }
      if (file === "3.jpg") throw new Error("fast fail");
    }, { concurrency: 4, attempts: 1 });
    expect(failures.map((item) => item.file)).toEqual(["1.jpg", "3.jpg"]);
  });

  it("publishes progress from the start, so the screen can say how many are left", async () => {
    const seen: MediaUploadProgress[] = [];
    await uploadAllMedia(["a", "b"], async () => {}, { concurrency: 1, onProgress: (p) => seen.push({ ...p }) });
    expect(seen[0]).toEqual({ done: 0, total: 2, failed: 0 });
    expect(seen[seen.length - 1]).toEqual({ done: 2, total: 2, failed: 0 });
  });

  it("counts a failed file as finished, so progress still reaches the end", async () => {
    const seen: MediaUploadProgress[] = [];
    await uploadAllMedia(["a"], async () => { throw new Error("no"); }, { concurrency: 1, attempts: 1, onProgress: (p) => seen.push({ ...p }) });
    expect(seen[seen.length - 1]).toEqual({ done: 1, total: 1, failed: 1 });
  });

  it("does nothing, and says nothing, when there are no files", async () => {
    const seen: MediaUploadProgress[] = [];
    const { failures } = await uploadAllMedia([], async () => { throw new Error("never"); }, { onProgress: (p) => seen.push({ ...p }) });
    expect(failures).toEqual([]);
    expect(seen).toEqual([{ done: 0, total: 0, failed: 0 }]);
  });
});

describe("what the person is told afterwards", () => {
  it("confirms a clean run", () => {
    expect(mediaUploadSummary(10, [])).toBe("10 files attached to the daily log.");
    expect(mediaUploadSummary(1, [])).toBe("1 file attached to the daily log.");
  });

  it("does not claim a partial run succeeded", () => {
    expect(mediaUploadSummary(10, [{ file: "x", message: "network" }]))
      .toBe("9 of 10 attached. 1 failed: network");
  });

  it("says plainly when nothing attached - the case he actually hit", () => {
    const failures = Array.from({ length: 10 }, (_, i) => ({ file: `${i}`, message: "network" }));
    expect(mediaUploadSummary(10, failures)).toBe("None of the 10 photos attached: network");
    expect(mediaUploadSummary(1, [{ file: "x", message: "network" }]))
      .toBe("The photo did not attach: network");
  });
});
