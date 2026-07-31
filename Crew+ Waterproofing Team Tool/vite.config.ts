import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: "127.0.0.1",
    allowedHosts: [".ngrok-free.dev", "matrix-demote-ripcord.ngrok-free.dev"],
  },
});
