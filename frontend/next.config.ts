import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // Never create an extra page cache from client-side navigation. StudyFlash pages
  // can contain user-owned/authenticated data, so HTML/RSC/API reads stay network-only.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  cacheStartUrl: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkOnly",
      options: {
        precacheFallback: {
          fallbackURL: "/_offline",
        },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "studyflash-next-static-v1",
        expiration: {
          maxEntries: 128,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "studyflash-static-images-v1",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      // All remaining GETs, including RSC payloads, auth/session reads and API data,
      // must come from the network. Mutating POST/server-action requests are never
      // intercepted by these GET-only Workbox routes.
      urlPattern: ({ url }) => url.origin === self.location.origin,
      handler: "NetworkOnly",
    },
  ],
  workboxOptions: {
    disableDevLogs: true,
    cleanupOutdatedCaches: true,
  },
});

const nextConfig: NextConfig = {};

export default withPWA(nextConfig);