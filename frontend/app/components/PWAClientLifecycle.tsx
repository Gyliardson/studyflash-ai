"use client";

import { useEffect } from "react";

const CURRENT_RUNTIME_CACHES = new Set([
  "studyflash-next-static-v1",
  "studyflash-static-images-v1",
]);

async function cleanupObsoleteStudyFlashCaches() {
  if (!("caches" in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith("studyflash-") && !CURRENT_RUNTIME_CACHES.has(cacheName))
      .map((cacheName) => caches.delete(cacheName)),
  );
}

export default function PWAClientLifecycle() {
  useEffect(() => {
    void cleanupObsoleteStudyFlashCaches();

    if (!("serviceWorker" in navigator)) return;
    const handleControllerChange = () => {
      void cleanupObsoleteStudyFlashCaches();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
  }, []);

  return null;
}
