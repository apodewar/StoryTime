"use client";

import { useEffect, useMemo } from "react";
import { createUuid } from "../lib/uuid";

type CompletionTrackerProps = {
  storyId: string;
  storyBodyId?: string;
  thresholdPx?: number;
};

const getSessionId = () => {
  const key = "storytime.anonSessionId";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = `anon_${createUuid()}`;
  window.localStorage.setItem(key, id);
  return id;
};

export default function CompletionTracker({
  storyId,
  storyBodyId = "story-body",
  thresholdPx = 8,
}: CompletionTrackerProps) {
  const sessionCompleteKey = useMemo(
    () => `storytime.complete.${storyId}`,
    [storyId],
  );

  useEffect(() => {
    let ticking = false;

    const sendComplete = async () => {
      if (window.sessionStorage.getItem(sessionCompleteKey) === "1") return;
      window.sessionStorage.setItem(sessionCompleteKey, "1");

      try {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId,
            eventType: "complete",
            anonSessionId: getSessionId(),
          }),
          keepalive: true,
        });
      } catch {
        // ignore telemetry failures
      }
    };

    const hasReachedBottom = () => {
      const target = document.getElementById(storyBodyId);
      if (target) {
        const rect = target.getBoundingClientRect();
        return rect.bottom <= window.innerHeight + thresholdPx;
      }
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;
      return scrollPosition >= pageHeight - thresholdPx;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        if (hasReachedBottom()) {
          sendComplete();
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [sessionCompleteKey, storyBodyId, storyId, thresholdPx]);

  return null;
}
