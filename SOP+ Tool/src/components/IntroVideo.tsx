import { useEffect, useState } from "react";

const SEEN_KEY = "intro-seen-v1";

export function hasSeenIntro() {
  return localStorage.getItem(SEEN_KEY) === "true";
}

export function resetIntroSeen() {
  localStorage.removeItem(SEEN_KEY);
}

export function IntroVideo() {
  const [dismissed, setDismissed] = useState(hasSeenIntro);
  const [errored, setErrored] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (dismissed) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch("/intro.mp4")
      .then((res) => {
        if (!res.ok) throw new Error("intro video missing");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [dismissed]);

  const close = () => {
    localStorage.setItem(SEEN_KEY, "true");
    setDismissed(true);
  };

  // SOP+ has never shipped an intro.mp4 - the Wizard and Crew+ do, this app
  // does not - so the fetch above 404s on every load. The overlay used to go
  // up before the video arrived, which meant every visit flashed a full-screen
  // spinner for a file that was never coming, and nothing recorded the failure
  // so it happened again on the next load. Waiting for the video means a
  // missing one is a silent no-op, and dropping an intro.mp4 into public/
  // still works with no code change.
  if (dismissed || errored || !videoUrl) return null;

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true" aria-label="SOP+ introduction">
      <video className="intro-video" src={videoUrl} autoPlay muted playsInline controls onEnded={close} onError={() => setErrored(true)} />
      <button className="intro-skip" onClick={close}>Skip intro</button>
    </div>
  );
}
