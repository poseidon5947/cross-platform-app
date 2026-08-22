import { useState } from "react";

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
  const close = () => {
    localStorage.setItem(SEEN_KEY, "true");
    setDismissed(true);
  };

  if (dismissed || errored) return null;

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true" aria-label="Warehouse Wizard introduction">
      <video className="intro-video" src="/intro.mp4" autoPlay muted playsInline controls onEnded={close} onError={() => setErrored(true)} />
      <button className="intro-skip" onClick={close}>Skip intro</button>
    </div>
  );
}
