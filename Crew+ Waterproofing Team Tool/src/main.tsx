import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { ToastProvider } from "./components/Toast";
import "./styles.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider><App /></ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

const previewHost = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname.endsWith(".ngrok-free.dev");

if (previewHost && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => caches?.keys?.().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))))
      .catch(() => undefined);
  });
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
