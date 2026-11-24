import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const siteUrl =
  process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.SITE_URL || "https://hiddenlewdstudios.vercel.app";

export default defineConfig({
  site: siteUrl,
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
