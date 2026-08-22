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

  if (dismissed || errored) return null;

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true" aria-label="Crew+ introduction">
      {videoUrl ? (
        <video className="intro-video" src={videoUrl} autoPlay muted playsInline controls onEnded={close} onError={() => setErrored(true)} />
      ) : (
        <div className="intro-loading" aria-hidden="true"><i /></div>
      )}
      <button className="intro-skip" onClick={close}>Skip intro</button>
    </div>
  );
}
