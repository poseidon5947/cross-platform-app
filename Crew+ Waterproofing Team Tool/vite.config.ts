import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("react")) return "vendor-react";
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5175,
    host: "127.0.0.1",
    allowedHosts: [".ngrok-free.dev", "matrix-demote-ripcord.ngrok-free.dev", ".trycloudflare.com"],
  },
});
