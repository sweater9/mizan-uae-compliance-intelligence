import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => {
  if (command === "build") {
    const origin = process.env.VITE_API_BASE_URL;
    if (!origin || new URL(origin).protocol !== "https:" || new URL(origin).origin !== origin) {
      throw new Error("Set VITE_API_BASE_URL to the HTTPS backend origin (no path or trailing slash) for the static deployment.");
    }
  }
  return {
  base: "/mizan-uae-compliance-intelligence/",
  plugins: [react()],
  build: {
    outDir: "pages-dist",
    emptyOutDir: true,
  },
};
});
